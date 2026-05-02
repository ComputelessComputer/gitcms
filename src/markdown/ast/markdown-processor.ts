import type { Root } from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";

const markdownProcessor = unified().use(remarkParse).use(remarkGfm).use(remarkStringify, {
  bullet: "-",
  emphasis: "_",
  fences: true,
  listItemIndent: "one",
  rule: "-",
  ruleSpaces: false,
  strong: "*",
});

export function parseMarkdownAst(markdown: string): Root {
  return markdownProcessor.parse(markdown) as Root;
}

export function stringifyMarkdownAst(tree: Root): string {
  return markdownProcessor.stringify(tree);
}
