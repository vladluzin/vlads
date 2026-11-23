/**
 * Converts the agent's light Markdown to Telegram's HTML parse mode (the subset Telegram
 * accepts: b, i, code, a). Everything else is escaped.
 */
export function markdownToTelegramHtml(md: string): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return md
    .split("\n")
    .map((line) => {
      let l = esc(line);
      const heading = l.match(/^#{1,4}\s+(.*)$/);
      if (heading) return `<b>${heading[1]}</b>`;
      l = l.replace(/^\s*[-*]\s+/, "• ");
      l = l.replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/__([^_]+)__/g, "<b>$1</b>");
      l = l.replace(/(^|[^*\w])\*([^*\s][^*]*)\*(?!\w)/g, "$1<i>$2</i>").replace(/(^|[^_\w])_([^_\s][^_]*)_(?!\w)/g, "$1<i>$2</i>");
      l = l.replace(/`([^`]+)`/g, "<code>$1</code>");
      l = l.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2">$1</a>');
      return l;
    })
    .join("\n");
}

/** Splits text into Telegram-sized pieces (limit 4096) at paragraph or line boundaries. */
export function splitMessage(text: string, limit = 3800): string[] {
  if (text.length <= limit) return [text];
  const parts: string[] = [];
  let rest = text;
  while (rest.length > limit) {
    let cut = rest.lastIndexOf("\n\n", limit);
    if (cut < limit / 2) cut = rest.lastIndexOf("\n", limit);
    if (cut < limit / 2) cut = limit;
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) parts.push(rest);
  return parts;
}
