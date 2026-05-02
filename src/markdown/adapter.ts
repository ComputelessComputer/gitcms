import type { JSONContent } from "@tiptap/react";

/** Converts repository markdown into editable Tiptap JSON and back. */
export interface MarkdownAdapter {
  parse(markdown: string): JSONContent;
  serialize(json: JSONContent): string;
}
