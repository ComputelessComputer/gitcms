import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { remarkMarkdownAdapter } from "../../src/markdown";

const fixturesDir = fileURLToPath(new URL("../fixtures/markdown", import.meta.url));
const fixtureNames = readdirSync(fixturesDir)
  .filter((name) => name.endsWith(".md"))
  .sort();

describe("remarkMarkdownAdapter round trips markdown fixtures", () => {
  it("covers at least fifteen standard markdown cases", () => {
    expect(fixtureNames.length).toBeGreaterThanOrEqual(15);
  });

  it.each(fixtureNames)("%s", (fixtureName) => {
    const original = readFileSync(join(fixturesDir, fixtureName), "utf8");
    const json = remarkMarkdownAdapter.parse(original);
    const serialized = remarkMarkdownAdapter.serialize(json);
    expect(serialized.trimEnd()).toBe(original.trimEnd());
  });
});
