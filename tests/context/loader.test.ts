import { beforeEach, describe, expect, it, vi } from "vitest";

import type { GitcmsConfig } from "../../src/config";
import { loadAuthorContext, mergeAuthorContext } from "../../src/context/loader";

const readRepoFileText =
  vi.fn<
    (token: string, config: GitcmsConfig, path: string, branch?: string) => Promise<string | null>
  >();

vi.mock("../../src/github/content", () => ({
  readRepoFileText: (token: string, config: GitcmsConfig, path: string, branch?: string) =>
    readRepoFileText(token, config, path, branch),
}));

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

beforeEach(() => {
  readRepoFileText.mockReset();
});

describe("mergeAuthorContext", () => {
  it("returns empty string when every part is null or blank", () => {
    expect(
      mergeAuthorContext({
        context: null,
        voice: null,
        collectionVoice: null,
        collectionLabel: null,
      }),
    ).toBe("");
    expect(
      mergeAuthorContext({
        context: "   \n  ",
        voice: "",
        collectionVoice: null,
        collectionLabel: null,
      }),
    ).toBe("");
  });

  it("includes only the parts that are non-empty", () => {
    const merged = mergeAuthorContext({
      context: "Acme is a B2B fintech.",
      voice: null,
      collectionVoice: null,
      collectionLabel: null,
    });
    expect(merged).toContain("# Brand & audience context");
    expect(merged).toContain("Acme is a B2B fintech.");
    expect(merged).not.toContain("# Voice & style");
  });

  it("orders sections: context, voice, collection voice", () => {
    const merged = mergeAuthorContext({
      context: "Brand stuff.",
      voice: "Repo tone.",
      collectionVoice: "Blog tone.",
      collectionLabel: "Blog",
    });
    const ctx = merged.indexOf("Brand stuff.");
    const repoVoice = merged.indexOf("Repo tone.");
    const collectionVoice = merged.indexOf("Blog tone.");
    expect(ctx).toBeGreaterThanOrEqual(0);
    expect(repoVoice).toBeGreaterThan(ctx);
    expect(collectionVoice).toBeGreaterThan(repoVoice);
    expect(merged).toContain("Voice & style — Blog");
  });

  it("falls back to a generic heading when no collection label is given", () => {
    const merged = mergeAuthorContext({
      context: null,
      voice: null,
      collectionVoice: "override",
      collectionLabel: null,
    });
    expect(merged).toContain("Voice & style — collection override");
  });
});

describe("loadAuthorContext", () => {
  it("reads repo-level files and skips collection voice when no collection given", async () => {
    readRepoFileText.mockImplementation(async (_token, _cfg, path) => {
      if (path === "content/.gitcms/context.md") return "Acme context";
      if (path === "content/.gitcms/voice.md") return "Acme voice";
      return null;
    });

    const result = await loadAuthorContext("token", config);

    expect(result.context).toBe("Acme context");
    expect(result.voice).toBe("Acme voice");
    expect(result.collectionVoice).toBeNull();
    expect(result.merged).toContain("Acme context");
    expect(result.merged).toContain("Acme voice");
    // when no collectionId is passed, the collection-voice read is short-circuited
    const requestedPaths = readRepoFileText.mock.calls.map((call) => call[2]);
    expect(requestedPaths).not.toContain("content/blog/.gitcms/voice.md");
  });

  it("includes the collection-level voice when collectionId is given", async () => {
    readRepoFileText.mockImplementation(async (_token, _cfg, path) => {
      if (path === "content/.gitcms/context.md") return "Brand";
      if (path === "content/.gitcms/voice.md") return "Repo voice";
      if (path === "content/blog/.gitcms/voice.md") return "Blog voice";
      return null;
    });

    const result = await loadAuthorContext("token", config, { collectionId: "blog" });

    expect(result.collectionVoice).toBe("Blog voice");
    expect(result.merged).toContain("Brand");
    expect(result.merged).toContain("Repo voice");
    expect(result.merged).toContain("Blog voice");
    expect(result.merged).toContain("Voice & style — Blog");
  });

  it("ignores unknown collection ids without throwing", async () => {
    readRepoFileText.mockResolvedValue(null);
    const result = await loadAuthorContext("token", config, { collectionId: "nope" });
    expect(result.collectionVoice).toBeNull();
    expect(result.merged).toBe("");
    // unknown collection: only the two repo-level reads happen
    expect(readRepoFileText).toHaveBeenCalledTimes(2);
  });

  it("returns null fields when files are missing or blank", async () => {
    readRepoFileText.mockImplementation(async (_token, _cfg, path) => {
      if (path === "content/.gitcms/context.md") return null;
      if (path === "content/.gitcms/voice.md") return "   \n   ";
      return null;
    });

    const result = await loadAuthorContext("token", config);
    expect(result.context).toBeNull();
    expect(result.voice).toBeNull();
    expect(result.merged).toBe("");
  });

  it("forwards the branch option to every read", async () => {
    readRepoFileText.mockResolvedValue(null);
    await loadAuthorContext("token", config, { collectionId: "blog", branch: "drafts" });
    for (const call of readRepoFileText.mock.calls) {
      expect(call[3]).toBe("drafts");
    }
  });

  it("propagates non-404 errors from the underlying reader", async () => {
    const boom = new Error("boom");
    readRepoFileText.mockRejectedValueOnce(boom);
    await expect(loadAuthorContext("token", config)).rejects.toThrow("boom");
  });
});
