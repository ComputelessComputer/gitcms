import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

/** Converts markdown into HTML suitable for Tiptap content. */
export function markdownToHtml(markdown: string): string {
  return marked.parse(markdown, { async: false, gfm: true }) as string;
}

/** Converts Tiptap HTML back into markdown with GFM table support. */
export function htmlToMarkdown(html: string): string {
  const turndown = new TurndownService({
    bulletListMarker: "-",
    codeBlockStyle: "fenced",
    headingStyle: "atx",
  });
  turndown.use(gfm);
  return turndown.turndown(html).trim();
}
