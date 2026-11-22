"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import { Markdown } from "./Markdown";

interface Msg { id: string | number; role: "user" | "assistant"; content: string }
interface Conv { id: string; title: string; channel: string; updatedAt: string }

/** Parses a text/event-stream body into (event, data) pairs. */
async function* sse(res: Response) {
  const reader = res.body!.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const chunk = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const event = chunk.match(/^event: (.*)$/m)?.[1];
      const data = chunk.match(/^data: (.*)$/m)?.[1];
      if (event && data) yield { event, data: JSON.parse(data) };
    }
  }
}

export function ChatApp({ locale, initialRemaining, isFree }: { locale: string; initialRemaining: number | null; isFree: boolean }) {
  const d = t(locale);
  const [convs, setConvs] = useState<Conv[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(initialRemaining);
  const endRef = useRef<HTMLDivElement>(null);

  const loadConvs = useCallback(async () => {
    const res = await fetch("/api/conversations");
    if (res.ok) setConvs((await res.json()).conversations);
  }, []);
  useEffect(() => { loadConvs(); }, [loadConvs]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, status]);

  async function open(id: string) {
    setActive(id);
    setBanner(null);
    const res = await fetch(`/api/conversations/${id}`);
    if (res.ok) setMsgs((await res.json()).messages);
  }

  async function remove(id: string) {
    if (!confirm("Delete this conversation?")) return;
    await fetch(`/api/conversations/${id}`, { method: "DELETE" });
    if (active === id) { setActive(null); setMsgs([]); }
    loadConvs();
  }

  async function send(text: string) {
    if (!text.trim() || busy) return;
    setInput("");
    setBanner(null);
    setBusy(true);
    setStatus(d.thinking);
    const replyId = `a-${Date.now()}`;
    setMsgs((m) => [...m, { id: `u-${Date.now()}`, role: "user", content: text }, { id: replyId, role: "assistant", content: "" }]);
    try {
      const res = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId: active, text }) });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
      for await (const { event, data } of sse(res)) {
        if (event === "text") {
          setStatus(null);
          setMsgs((m) => m.map((x) => (x.id === replyId ? { ...x, content: x.content + data.delta } : x)));
        } else if (event === "tool") {
          setStatus(d.toolLabels[data.name] ?? d.thinking);
        } else if (event === "done") {
          setActive(data.conversationId);
          setRemaining(data.remaining);
          loadConvs();
        } else if (event === "error") {
          setMsgs((m) => m.filter((x) => x.id !== replyId || x.content));
          if (data.code === "free_exhausted") setBanner(d.outOfMessages);
          else if (data.code === "daily_limit") setBanner(d.dailyLimit);
          else if (data.code === "no_profile") window.location.href = "/onboarding";
          else setBanner(data.message);
        }
      }
    } catch (e) {
      setBanner(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      setStatus(null);
    }
  }

  return (
    <div className="chat">
      <aside>
        <button className="secondary" onClick={() => { setActive(null); setMsgs([]); setBanner(null); }}>+ {d.newChat}</button>
        {convs.map((c) => (
          <div key={c.id} className={`conv ${c.id === active ? "active" : ""}`}>
            <button className="open" title={c.title} onClick={() => open(c.id)}>{c.channel === "telegram" ? "✈ " : ""}{c.title}</button>
            <button className="ghost" aria-label="Delete" onClick={() => remove(c.id)}>×</button>
          </div>
        ))}
      </aside>
      <main>
        <div className="messages">
          {msgs.length === 0 && (
            <div className="suggestions">
              {d.suggestions.map((s) => (<button key={s} onClick={() => send(s)}>{s}</button>))}
            </div>
          )}
          {msgs.map((m) => (
            <div key={m.id} className={`msg ${m.role}`}>
              {(m.content || m.role === "user") && (
                <div className="bubble">{m.role === "assistant" ? <Markdown text={m.content} /> : m.content}</div>
              )}
            </div>
          ))}
          {status && <div className="msg"><div className="status">{status}</div></div>}
          <div ref={endRef} />
        </div>
        <div className="composer">
          {banner && (
            <div className="banner">{banner} {(banner === d.outOfMessages || banner === d.dailyLimit) && <Link href="/pricing">{d.pricing} →</Link>}</div>
          )}
          {isFree && remaining !== null && remaining <= 3 && !banner && (
            <div className="banner">{remaining} free {remaining === 1 ? "message" : "messages"} left · <Link href="/pricing">{d.pricing}</Link></div>
          )}
          <form onSubmit={(e) => { e.preventDefault(); send(input); }}>
            <textarea
              rows={1}
              value={input}
              placeholder={d.askPlaceholder}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            />
            <button disabled={busy || !input.trim()}>{d.send}</button>
          </form>
        </div>
      </main>
    </div>
  );
}
