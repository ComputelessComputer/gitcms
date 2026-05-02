import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GitcmsConfig } from "../../src/config";

const loadAuthorContext = vi.fn();
const getRuntimeConfig = vi.fn();
const getEnv = vi.fn();
const resolveIdentity = vi.fn();
const resolve = vi.fn();
const getGitHubTokenForIdentity = vi.fn();

vi.mock("../../src/context", () => ({
  loadAuthorContext: (...args: unknown[]) => loadAuthorContext(...args),
}));
vi.mock("../../src/server/runtime-config", () => ({
  getRuntimeConfig: () => getRuntimeConfig(),
}));
vi.mock("../../src/env", () => ({ getEnv: () => getEnv() }));
vi.mock("../../src/auth", () => ({
  getAuthAdapter: () => ({ resolveIdentity }),
  getMembersProvider: () => ({ resolve }),
  getGitHubTokenForIdentity: (...args: unknown[]) => getGitHubTokenForIdentity(...args),
}));

import { handleContextGet } from "../../src/server/handlers/context-get";

const fakeConfig: GitcmsConfig = {
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

const sampleResult = {
  context: "Brand",
  voice: "Voice",
  collectionVoice: null,
  merged: "# Brand & audience context\n\nBrand\n\n# Voice & style\n\nVoice",
};

beforeEach(() => {
  loadAuthorContext.mockReset();
  getRuntimeConfig.mockReset();
  getEnv.mockReset();
  resolveIdentity.mockReset();
  resolve.mockReset();
  getGitHubTokenForIdentity.mockReset();
  getRuntimeConfig.mockResolvedValue(fakeConfig);
});

afterEach(() => vi.clearAllMocks());

describe("GET /api/context", () => {
  it("returns 200 with the merged context using the service token in public mode", async () => {
    getEnv.mockReturnValue({
      GITCMS_CONTEXT_PUBLIC: true,
      GITCMS_GITHUB_SERVICE_TOKEN: "service-pat",
    });
    loadAuthorContext.mockResolvedValue(sampleResult);

    const response = await handleContextGet(
      new Request("http://localhost/api/context?collection=blog"),
    );
    expect(response.status).toBe(200);
    expect(loadAuthorContext).toHaveBeenCalledWith("service-pat", fakeConfig, {
      collectionId: "blog",
      branch: undefined,
    });
    expect(await response.json()).toEqual(sampleResult);
    // Anonymous public mode must not attempt identity resolution
    expect(resolveIdentity).not.toHaveBeenCalled();
  });

  it("falls back to authenticated mode in public mode when no service token is set", async () => {
    getEnv.mockReturnValue({
      GITCMS_CONTEXT_PUBLIC: true,
      GITCMS_GITHUB_SERVICE_TOKEN: undefined,
    });
    resolveIdentity.mockResolvedValue({ provider: "github", subject: "alice" });
    resolve.mockResolvedValue({ identifier: "alice", role: "admin" });
    getGitHubTokenForIdentity.mockResolvedValue("user-token");
    loadAuthorContext.mockResolvedValue(sampleResult);

    const response = await handleContextGet(new Request("http://localhost/api/context"));
    expect(response.status).toBe(200);
    expect(loadAuthorContext).toHaveBeenCalledWith(
      "user-token",
      fakeConfig,
      expect.objectContaining({ branch: undefined, collectionId: undefined }),
    );
  });

  it("returns 401 when public mode falls back and the user is not signed in", async () => {
    getEnv.mockReturnValue({
      GITCMS_CONTEXT_PUBLIC: true,
      GITCMS_GITHUB_SERVICE_TOKEN: undefined,
    });
    resolveIdentity.mockResolvedValue(null);

    const response = await handleContextGet(new Request("http://localhost/api/context"));
    expect(response.status).toBe(401);
    expect(loadAuthorContext).not.toHaveBeenCalled();
  });

  it("returns 401 when authenticated mode is required but identity is not a member", async () => {
    getEnv.mockReturnValue({
      GITCMS_CONTEXT_PUBLIC: false,
      GITCMS_GITHUB_SERVICE_TOKEN: "ignored-when-private",
    });
    resolveIdentity.mockResolvedValue({ provider: "github", subject: "alice" });
    resolve.mockResolvedValue(null);

    const response = await handleContextGet(new Request("http://localhost/api/context"));
    expect(response.status).toBe(401);
    expect(loadAuthorContext).not.toHaveBeenCalled();
  });

  it("uses the caller's GitHub token in authenticated-only mode", async () => {
    getEnv.mockReturnValue({
      GITCMS_CONTEXT_PUBLIC: false,
      GITCMS_GITHUB_SERVICE_TOKEN: "ignored-when-private",
    });
    resolveIdentity.mockResolvedValue({ provider: "github", subject: "alice" });
    resolve.mockResolvedValue({ identifier: "alice", role: "admin" });
    getGitHubTokenForIdentity.mockResolvedValue("user-token");
    loadAuthorContext.mockResolvedValue(sampleResult);

    const response = await handleContextGet(
      new Request("http://localhost/api/context?branch=drafts"),
    );
    expect(response.status).toBe(200);
    expect(loadAuthorContext).toHaveBeenCalledWith(
      "user-token",
      fakeConfig,
      expect.objectContaining({ branch: "drafts" }),
    );
  });

  it("returns 500 with a JSON error body when the loader throws", async () => {
    getEnv.mockReturnValue({
      GITCMS_CONTEXT_PUBLIC: true,
      GITCMS_GITHUB_SERVICE_TOKEN: "service-pat",
    });
    loadAuthorContext.mockRejectedValue(new Error("github exploded"));
    const response = await handleContextGet(new Request("http://localhost/api/context"));
    expect(response.status).toBe(500);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe("github exploded");
  });
});
