import { describe, expect, it } from "vitest";

import {
  getFolder,
  getName,
  normalizeVirtualPath,
  slugify,
  toMarkdownFilename,
} from "../../src/lib/slug";

describe("slug helpers", () => {
  it("creates stable ascii slugs", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
    expect(slugify(" Crème brûlée ")).toBe("creme-brulee");
  });

  it("creates markdown filenames", () => {
    expect(toMarkdownFilename("Launch Post")).toBe("launch-post.md");
    expect(toMarkdownFilename("Launch Post", "mdx")).toBe("launch-post.mdx");
  });

  it("normalizes virtual paths", () => {
    expect(normalizeVirtualPath("Blog/../Launch Post")).toBe("blog/launch-post");
    expect(getFolder("blog/cover.jpg")).toBe("blog");
    expect(getName("blog/cover.jpg")).toBe("cover.jpg");
  });
});
