import { sql } from "drizzle-orm";
import { db, schema } from "./db";

export interface KnowledgeHit {
  title: string;
  heading: string | null;
  content: string;
  rank: number;
}

/**
 * Full-text search over the reference library (Postgres, language-agnostic 'simple' config).
 * Good enough for a curated library of a few hundred chunks; swap in embeddings + pgvector
 * when the library grows or becomes multilingual.
 */
export async function searchKnowledge(query: string, limit = 4): Promise<KnowledgeHit[]> {
  const doc = sql`to_tsvector('simple', ${schema.knowledgeChunks.heading} || ' ' || ${schema.knowledgeChunks.content})`;
  // OR the words together so partial matches still rank.
  const words = query
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2)
    .slice(0, 12);
  if (!words.length) return [];
  const tsq = sql`to_tsquery('simple', ${words.map((w) => w.replace(/'/g, "")).join(" | ")})`;
  const rows = await db
    .select({
      title: schema.knowledgeDocs.title,
      heading: schema.knowledgeChunks.heading,
      content: schema.knowledgeChunks.content,
      rank: sql<number>`ts_rank(${doc}, ${tsq})`,
    })
    .from(schema.knowledgeChunks)
    .innerJoin(schema.knowledgeDocs, sql`${schema.knowledgeDocs.id} = ${schema.knowledgeChunks.docId}`)
    .where(sql`${doc} @@ ${tsq}`)
    .orderBy(sql`4 desc`)
    .limit(limit);
  return rows;
}

/** Splits a Markdown document into chunks at "## " headings (and long sections by paragraph). */
export function chunkMarkdown(md: string, maxChars = 1800): { heading: string | null; content: string }[] {
  const sections = md.split(/^## /m);
  const out: { heading: string | null; content: string }[] = [];
  for (const [i, s] of sections.entries()) {
    const text = s.trim();
    if (!text) continue;
    const [first, ...rest] = text.split("\n");
    const heading = i === 0 && !md.startsWith("## ") ? null : first.trim();
    const body = (heading ? rest.join("\n") : text).trim();
    let buf = "";
    for (const para of body.split(/\n\s*\n/)) {
      if (buf && buf.length + para.length > maxChars) {
        out.push({ heading, content: buf.trim() });
        buf = "";
      }
      buf += para + "\n\n";
    }
    if (buf.trim()) out.push({ heading, content: buf.trim() });
  }
  return out;
}
