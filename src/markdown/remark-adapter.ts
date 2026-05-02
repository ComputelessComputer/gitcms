import type { JSONContent } from "@tiptap/react";

import type { MarkdownAdapter } from "./adapter";
import { jsonToMdast } from "./ast/json-to-mdast";
import { parseMarkdownAst, stringifyMarkdownAst } from "./ast/markdown-processor";
import { mdastToJson } from "./ast/mdast-to-json";
import { extractRawMdx } from "./ast/raw-mdx-extract";

const frontmatterAttr = "gitcmsFrontmatter";

/** Default MarkdownAdapter backed by remark/mdast. */
export const remarkMarkdownAdapter: MarkdownAdapter = {
  parse(markdown) {
    const { frontmatter, body } = splitFrontmatter(markdown);
    const extracted = extractRawMdx(body);
    const json = mdastToJson(parseMarkdownAst(extracted.markdown), {
      rawMdxById: extracted.rawMdxById,
    });
    if (!frontmatter) {
      return json;
    }
    return {
      ...json,
      attrs: {
        ...json.attrs,
        [frontmatterAttr]: frontmatter,
      },
    };
  },
  serialize(json) {
    const frontmatter = stringAttr(json.attrs, frontmatterAttr);
    const tree = jsonToMdast(json);
    const body = stringifyMarkdownAst(tree).trimEnd();
    if (!frontmatter) {
      return body;
    }
    return body ? `${frontmatter}${body}` : frontmatter.trimEnd();
  },
};

export function splitFrontmatter(markdown: string): { frontmatter: string | null; body: string } {
  const match = markdown.match(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n)*/);
  if (!match?.[0]) {
    return { frontmatter: null, body: markdown };
  }
  return {
    frontmatter: match[0],
    body: markdown.slice(match[0].length),
  };
}

function stringAttr(attrs: JSONContent["attrs"], key: string): string | undefined {
  const value = attrs?.[key];
  return typeof value === "string" ? value : undefined;
}
