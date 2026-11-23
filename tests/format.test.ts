import { describe, expect, it } from "vitest";
import { markdownToTelegramHtml, splitMessage } from "@/lib/telegram/format";
import { chunkMarkdown } from "@/lib/knowledge";
import { placeLabel } from "@/lib/geo/geocode";

describe("telegram formatting", () => {
  it("converts light markdown and escapes HTML", () => {
    expect(markdownToTelegramHtml("**Saturn** in *Libra* <script>")).toBe("<b>Saturn</b> in <i>Libra</i> &lt;script&gt;");
    expect(markdownToTelegramHtml("- one\n## Title")).toBe("• one\n<b>Title</b>");
  });
  it("splits long text at paragraph boundaries under the limit", () => {
    const text = Array.from({ length: 30 }, (_, i) => `Paragraph ${i} ` + "x".repeat(200)).join("\n\n");
    const parts = splitMessage(text, 1000);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.every((p) => p.length <= 1000)).toBe(true);
    expect(parts.join("\n\n").replace(/\s+/g, "")).toBe(text.replace(/\s+/g, ""));
  });
});

describe("knowledge chunking", () => {
  it("splits by ## headings", () => {
    const chunks = chunkMarkdown("intro text\n\n## Sun\nabout sun\n\n## Moon\nabout moon");
    expect(chunks.map((c) => c.heading)).toEqual([null, "Sun", "Moon"]);
  });
});

describe("place label", () => {
  it("drops repeated parts", () => {
    expect(placeLabel({ name: "Bishkek", admin: "Bishkek", country: "Kyrgyzstan" })).toBe("Bishkek, Kyrgyzstan");
  });
});
