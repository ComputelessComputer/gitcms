import { describe, expect, it } from "vitest";

import { jsonToMdast } from "../../src/markdown/ast/json-to-mdast";
import { mdastToJson } from "../../src/markdown/ast/mdast-to-json";
import { remarkMarkdownAdapter } from "../../src/markdown";

describe("remark markdown adapter", () => {
  it("preserves frontmatter when parsing a complete file", () => {
    const source = "---\ntitle: Test\n---\n\n# Hello";
    expect(remarkMarkdownAdapter.serialize(remarkMarkdownAdapter.parse(source))).toBe(source);
  });

  it("maps GFM task list state through list item attrs", () => {
    const json = remarkMarkdownAdapter.parse("- [x] Done\n- [ ] Todo");
    expect(json.content?.[0]?.content?.[0]?.attrs?.checked).toBe(true);
    expect(json.content?.[0]?.content?.[1]?.attrs?.checked).toBe(false);
    expect(remarkMarkdownAdapter.serialize(json)).toBe("- [x] Done\n- [ ] Todo");
  });

  it("maps markdown tables to Tiptap table nodes", () => {
    const json = remarkMarkdownAdapter.parse("| Name | Count |\n| --- | --: |\n| Alpha | 1 |");
    expect(json.content?.[0]?.type).toBe("table");
    expect(json.content?.[0]?.attrs?.align).toEqual([null, "right"]);
    expect(remarkMarkdownAdapter.serialize(json)).toBe(
      "| Name  | Count |\n| ----- | ----: |\n| Alpha |     1 |",
    );
  });

  it("converts mdast and json without going through HTML", () => {
    const tree = jsonToMdast(
      mdastToJson({
        type: "root",
        children: [
          {
            type: "heading",
            depth: 2,
            children: [{ type: "text", value: "Heading" }],
          },
          {
            type: "paragraph",
            children: [
              { type: "text", value: "Hello " },
              { type: "strong", children: [{ type: "text", value: "world" }] },
            ],
          },
        ],
      }),
    );

    expect(tree).toEqual({
      type: "root",
      children: [
        {
          type: "heading",
          depth: 2,
          children: [{ type: "text", value: "Heading" }],
        },
        {
          type: "paragraph",
          children: [
            { type: "text", value: "Hello " },
            { type: "strong", children: [{ type: "text", value: "world" }] },
          ],
        },
      ],
    });
  });
});
