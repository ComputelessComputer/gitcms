import { describe, expect, it } from "vitest";

import { parseMarkdown, roundTripMarkdown, serializeMarkdown } from "../../src/lib/markdown";

describe("markdown frontmatter", () => {
  it("parses frontmatter and body", () => {
    const parsed = parseMarkdown("---\ntitle: Test\ntags:\n  - cms\n---\n\n# Hello");
    expect(parsed.frontmatter.title).toBe("Test");
    expect(parsed.frontmatter.tags).toEqual(["cms"]);
    expect(parsed.body.trim()).toBe("# Hello");
  });

  it("serializes frontmatter deterministically", () => {
    const serialized = serializeMarkdown({
      frontmatter: { title: "Test", draft: false },
      body: "# Hello\n\nBody",
    });
    expect(serialized).toContain("draft: false");
    expect(serialized).toContain('title: Test');
    expect(serialized).toContain("# Hello");
  });

  it("round trips common markdown structures", () => {
    const source = [
      "---",
      "title: Round Trip",
      "---",
      "",
      "# Heading",
      "",
      "**Bold** and _italic_ with [link](https://example.com).",
      "",
      "- one",
      "- two",
      "",
      "> quote",
      "",
      "```ts",
      "const value = 1;",
      "```",
      "",
      "![alt](https://example.com/image.png)",
    ].join("\n");
    expect(roundTripMarkdown(source)).toContain("![alt](https://example.com/image.png)");
  });
});
