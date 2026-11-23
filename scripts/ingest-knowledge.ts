// Loads every Markdown file in ./knowledge into the reference library (replacing earlier versions).
// The first "# " line is the title; "## " headings become chunk headings.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db, schema } from "../src/lib/db";
import { chunkMarkdown } from "../src/lib/knowledge";

const dir = path.resolve("knowledge");
for (const file of (await readdir(dir)).filter((f) => f.endsWith(".md"))) {
  const md = await readFile(path.join(dir, file), "utf8");
  const slug = file.replace(/\.md$/, "");
  const title = md.match(/^# (.+)$/m)?.[1]?.trim() ?? slug;
  const lang = slug.match(/\.(\w\w)$/)?.[1] ?? "en";
  const body = md.replace(/^# .+$/m, "").trim();
  await db.delete(schema.knowledgeDocs).where(eq(schema.knowledgeDocs.slug, slug));
  const [doc] = await db.insert(schema.knowledgeDocs).values({ slug, title, lang }).returning();
  const chunks = chunkMarkdown(body);
  if (chunks.length) await db.insert(schema.knowledgeChunks).values(chunks.map((c) => ({ ...c, docId: doc.id })));
  console.log(`${slug}: ${chunks.length} chunks`);
}
process.exit(0);
