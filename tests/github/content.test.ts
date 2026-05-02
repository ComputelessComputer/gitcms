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
  it("routes collection files under the configured content root", () => {
    expect(contentFileRepoPath(config.content, config.collections[0]!, "Hello World")).toBe(
      "content/blog/hello-world.md",
    );
  });

  it("builds working branch names from the configured prefix", () => {
    expect(contentWorkingBranch(config.content.workingBranchPrefix, "Hello World")).toBe(
      "gitcms/hello-world",
    );
  });
});
