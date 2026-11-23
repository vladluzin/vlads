import { after } from "next/server";
import { z } from "zod";
import { AgentError, afterTurn, runTurn } from "@/lib/agent/run";
import { isResponse, parseBody, requireUser } from "@/lib/http";

export const maxDuration = 300;

const Body = z.object({ conversationId: z.string().uuid().nullable(), text: z.string().trim().min(1).max(4000) });

/**
 * Streams one agent turn as Server-Sent Events:
 *   tool  {name}            the agent started a calculation
 *   text  {delta}           a fragment of the reply
 *   done  {conversationId, remaining}
 *   error {code, message}
 */
export async function POST(req: Request) {
  const user = await requireUser();
  if (isResponse(user)) return user;
  const body = await parseBody(req, Body);
  if (isResponse(body)) return body;

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(enc.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      try {
        const res = await runTurn({
          userId: user.id,
          conversationId: body.conversationId,
          text: body.text,
          channel: "web",
          onText: (delta) => send("text", { delta }),
          onTool: (name) => send("tool", { name }),
          signal: req.signal,
        });
        send("done", { conversationId: res.conversationId, remaining: res.remaining });
        after(() => afterTurn(res.conversationId));
      } catch (e) {
        if (e instanceof AgentError) send("error", { code: e.code, message: e.message });
        else {
          console.error("chat error", e);
          send("error", { code: "internal", message: "Something went wrong. Please try again." });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" },
  });
}
