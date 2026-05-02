import { describe, expect, it } from "vitest";

import type { GitcmsConfig } from "../../src/config";
import {
  collectionVoicePath,
  listAuthorContextPaths,
  repoContextPath,
  repoVoicePath,
} from "../../src/context/paths";

const config: GitcmsConfig = {
  content: {
    repo: "alice/site",
    branch: "main",
    path: "content",
    workingBranchPrefix: "gitcms/",
  },
  collections: [
    {
      id: "blog",
      label: "Blog",
      path: "blog",
      bodyFormat: "markdown",
      schema: { title: { type: "string", required: true } },
    },
    {
      id: "docs",
      label: "Docs",
      path: "docs",
      bodyFormat: "markdown",
      schema: { title: { type: "string", required: true } },
    },
  ],
};

describe("author context paths", () => {
  it("derives the repo-level context path under the content root", () => {
    expect(repoContextPath(config.content)).toBe("content/.gitcms/context.md");
  });

  it("derives the repo-level voice path under the content root", () => {
    expect(repoVoicePath(config.content)).toBe("content/.gitcms/voice.md");
  });

  it("derives a collection-level voice override path", () => {
    const blog = config.collections[0];
    if (!blog) throw new Error("test fixture: missing blog collection");
    expect(collectionVoicePath(config.content, blog)).toBe("content/blog/.gitcms/voice.md");
  });

  it("listAuthorContextPaths returns repo paths only when no collection given", () => {
    const paths = listAuthorContextPaths(config);
    expect(paths.repoContext).toBe("content/.gitcms/context.md");
    expect(paths.repoVoice).toBe("content/.gitcms/voice.md");
    expect(paths.collectionVoice).toBeNull();
  });

  it("listAuthorContextPaths includes the collection-level path when collection matches", () => {
    const paths = listAuthorContextPaths(config, "docs");
    expect(paths.collectionVoice).toBe("content/docs/.gitcms/voice.md");
  });

  it("listAuthorContextPaths returns null collectionVoice for unknown collection ids", () => {
    const paths = listAuthorContextPaths(config, "nope");
    expect(paths.collectionVoice).toBeNull();
  });

  it("handles empty content path without producing leading slashes", () => {
    const flat: GitcmsConfig = {
      ...config,
      content: { ...config.content, path: "" },
    };
    expect(repoContextPath(flat.content)).toBe(".gitcms/context.md");
    expect(repoVoicePath(flat.content)).toBe(".gitcms/voice.md");
  });
});
