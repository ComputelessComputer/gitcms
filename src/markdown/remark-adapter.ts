import type { JSONContent } from "@tiptap/react";
import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

import type { MarkdownAdapter } from "./adapter";
import { jsonToMdast } from "./ast/json-to-mdast";
import { mdastToJson } from "./ast/mdast-to-json";

const frontmatterAttr = "gitcmsFrontmatter";

const markdownProcessor = unified().use(remarkParse).use(remarkGfm).use(remarkStringify, {
  bullet: "-",
  emphasis: "_",
  fences: true,
  listItemIndent: "one",
  rule: "-",
  ruleSpaces: false,
  strong: "*",
});

/** Default MarkdownAdapter backed by remark/mdast. */
export const remarkMarkdownAdapter: MarkdownAdapter = {
  parse(markdown) {
    const { frontmatter, body } = splitFrontmatter(markdown);
    const json = mdastToJson(parseMarkdownAst(body));
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

export function parseMarkdownAst(markdown: string): Root {
  return markdownProcessor.parse(markdown) as Root;
}

export function stringifyMarkdownAst(tree: Root): string {
  return markdownProcessor.stringify(tree);
}

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
