import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { JSONContent } from "@tiptap/react";
import { describe, expect, it } from "vitest";

import { remarkMarkdownAdapter } from "../../src/markdown";

const fixturesDir = fileURLToPath(new URL("../fixtures/markdown", import.meta.url));

const componentCases = [
  ["with-callout.mdx", "mintlifyCallout"],
  ["with-card.mdx", "mintlifyCard"],
  ["with-tabs.mdx", "mintlifyTabs"],
  ["with-tabs.mdx", "mintlifyTab"],
  ["with-steps.mdx", "mintlifySteps"],
  ["with-steps.mdx", "mintlifyStep"],
  ["with-accordion.mdx", "mintlifyAccordion"],
  ["with-code-group.mdx", "mintlifyCodeGroup"],
  ["with-code-group.mdx", "mintlifyCodeGroupItem"],
] as const;

const fixtureNames = [
  "with-callout.mdx",
  "with-card.mdx",
  "with-tabs.mdx",
  "with-steps.mdx",
  "with-accordion.mdx",
  "with-code-group.mdx",
];

describe("Mintlify component registry", () => {
  it.each(componentCases)("maps %s to %s", (fixtureName, nodeType) => {
    const original = readFixture(fixtureName);
    const json = remarkMarkdownAdapter.parse(original);
    expect(findNode(json, nodeType)).toBeDefined();
  });

  it.each(["Callout", "Card", "Tabs", "Steps", "Accordion", "CodeGroup"])(
    "keeps unknown %s-shaped alternatives as raw MDX",
    (name) => {
      const json = remarkMarkdownAdapter.parse(`<${name}Custom>value</${name}Custom>`);
      expect(findNode(json, "rawMdx")).toBeDefined();
    },
  );

  it.each(fixtureNames)("structurally round trips %s", (fixtureName) => {
    const original = readFixture(fixtureName);
    const json = remarkMarkdownAdapter.parse(original);
    const serialized = remarkMarkdownAdapter.serialize(json);
    expect(remarkMarkdownAdapter.parse(serialized)).toEqual(json);
  });
});

function readFixture(name: string): string {
  return readFileSync(join(fixturesDir, name), "utf8");
}

function findNode(node: JSONContent, type: string): JSONContent | undefined {
  if (node.type === type) {
    return node;
  }

  for (const child of node.content ?? []) {
    const match = findNode(child, type);
    if (match) {
      return match;
    }
  }

  return undefined;
}
