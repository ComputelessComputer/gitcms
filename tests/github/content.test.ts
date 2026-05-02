import { describe, expect, it } from "vitest";

import type { GitcmsConfig } from "../../src/config";
import { contentFileRepoPath, contentWorkingBranch } from "../../src/github/content-paths";

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
  ],
};

describe("GitHub content path helpers", () => {
  const [blogCollection] = config.collections;
  if (!blogCollection) throw new Error("test fixture: missing blog collection");

  it("routes collection files under the configured content root", () => {
    expect(contentFileRepoPath(config.content, blogCollection, "Hello World")).toBe(
      "content/blog/hello-world.md",
    );
  });

  it("builds working branch names from the configured prefix", () => {
    expect(contentWorkingBranch(config.content.workingBranchPrefix, "Hello World")).toBe(
      "gitcms/hello-world",
    );
  });
});
