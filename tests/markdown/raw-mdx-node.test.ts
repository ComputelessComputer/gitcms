import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import type { JSONContent } from "@tiptap/react";
import { describe, expect, it } from "vitest";

import { remarkMarkdownAdapter } from "../../src/markdown";

const fixturesDir = fileURLToPath(new URL("../fixtures/markdown", import.meta.url));
const registeredComponentFixtures = new Set([
  "with-accordion.mdx",
  "with-callout.mdx",
  "with-card.mdx",
  "with-code-group.mdx",
  "with-steps.mdx",
  "with-tabs.mdx",
]);
const fixtureNames = readdirSync(fixturesDir)
  .filter((name) => name.endsWith(".mdx"))
  .filter((name) => !registeredComponentFixtures.has(name))
  .sort();

describe("RawMdx fallback nodes", () => {
  it.each(fixtureNames)("round trips %s byte-identically", (fixtureName) => {
    const original = readFileSync(join(fixturesDir, fixtureName), "utf8");
    const json = remarkMarkdownAdapter.parse(original);
    const serialized = remarkMarkdownAdapter.serialize(json);
    expect(serialized.trimEnd()).toBe(original.trimEnd());
  });

  it("keeps flow JSX as rawMdx blocks", () => {
    const json = remarkMarkdownAdapter.parse('<MyComponent prop="x">child</MyComponent>');
    const rawMdx = findRawMdx(json);
    expect(rawMdx?.attrs).toMatchObject({
      raw: '<MyComponent prop="x">child</MyComponent>',
      kind: "flow",
      name: "MyComponent",
      attributesText: 'prop="x"',
    });
  });

  it("keeps inline JSX as rawMdx text nodes", () => {
    const json = remarkMarkdownAdapter.parse('Read <Badge label="New" /> now.');
    const rawMdx = findRawMdx(json);
    expect(rawMdx?.attrs).toMatchObject({
      raw: '<Badge label="New" />',
      kind: "text",
      name: "Badge",
      attributesText: 'label="New"',
    });
  });
});

function findRawMdx(node: JSONContent): JSONContent | undefined {
  if (node.type === "rawMdx") {
    return node;
  }

  for (const child of node.content ?? []) {
    const match = findRawMdx(child);
    if (match) {
      return match;
    }
  }

  return undefined;
}
