import { describe, expect, it, vi } from "vitest";

import { GitHubStorageAdapter } from "../../src/storage/github";

interface MockOctokit {
  repos: {
    get: ReturnType<typeof vi.fn>;
    getContent: ReturnType<typeof vi.fn>;
    createOrUpdateFileContents: ReturnType<typeof vi.fn>;
    deleteFile: ReturnType<typeof vi.fn>;
  };
  git: { getBlob: ReturnType<typeof vi.fn> };
}

function makeOctokit(overrides: Partial<MockOctokit["repos"]> = {}): MockOctokit {
  return {
    repos: {
      get: vi.fn(async () => ({ data: { default_branch: "main" } })),
      getContent: vi.fn(async () => ({ data: [] })),
      createOrUpdateFileContents: vi.fn(async () => ({ data: {} })),
      deleteFile: vi.fn(async () => ({ data: {} })),
      ...overrides,
    },
    git: { getBlob: vi.fn() },
  };
}

function makeAdapter(client: MockOctokit): GitHubStorageAdapter {
  return new GitHubStorageAdapter({
    repo: "owner/repo",
    branch: "main",
    mediaPath: "public/uploads",
    token: "ghp_test",
    isPublic: true,
    client: client as never,
  });
}

describe("GitHubStorageAdapter", () => {
  it("returns a server-proxied upload URL pointing at /api/media/upload", async () => {
    const result = await makeAdapter(makeOctokit()).createSignedUpload({
      filename: "cover.jpg",
      folder: "blog",
      contentType: "image/jpeg",
    });

    expect(result.method).toBe("PUT");
    expect(result.libraryPath).toBe("blog/cover.jpg");
    expect(result.uploadUrl).toContain("/api/media/upload");
    expect(result.uploadUrl).toContain("path=blog%2Fcover.jpg");
    expect(result.uploadUrl).toContain("contentType=image%2Fjpeg");
  });

  it("commits an upload via createOrUpdateFileContents with base64 bytes", async () => {
    const client = makeOctokit({
      // 404 means the file doesn't exist yet — fresh upload, no sha.
      getContent: vi.fn(async () => {
        const err = new Error("Not Found") as Error & { status: number };
        err.status = 404;
        throw err;
      }),
    });

    const adapter = makeAdapter(client);
    const item = await adapter.commitUpload({
      libraryPath: "blog/cover.jpg",
      bytes: Buffer.from("hello world"),
      contentType: "image/jpeg",
      upsert: false,
    });

    expect(client.repos.createOrUpdateFileContents).toHaveBeenCalledTimes(1);
    const callArg = client.repos.createOrUpdateFileContents.mock.calls[0]?.[0];
    expect(callArg).toMatchObject({
      owner: "owner",
      repo: "repo",
      path: "public/uploads/blog/cover.jpg",
      branch: "main",
    });
    expect(callArg.content).toBe(Buffer.from("hello world").toString("base64"));
    expect(callArg.message).toContain("media: add");
    expect(item.path).toBe("blog/cover.jpg");
    expect(item.size).toBe(11);
    expect(item.publicUrl).toBe(
      "https://raw.githubusercontent.com/owner/repo/main/public/uploads/blog/cover.jpg",
    );
  });

  it("rejects uploads above the 25 MB GitHub Contents API ceiling", async () => {
    const adapter = makeAdapter(makeOctokit());
    await expect(
      adapter.commitUpload({
        libraryPath: "huge.bin",
        bytes: Buffer.alloc(26 * 1024 * 1024),
        contentType: "application/octet-stream",
        upsert: false,
      }),
    ).rejects.toThrow(/25 MB/);
  });

  it("returns a proxy URL for private repos and a CDN URL when configured", () => {
    const adapter = new GitHubStorageAdapter({
      repo: "owner/repo",
      branch: "main",
      mediaPath: "public/uploads",
      token: "ghp_test",
      isPublic: false,
      client: makeOctokit() as never,
    });
    expect(adapter.getPublicUrl("blog/cover.jpg")).toBe(
      "/api/media/download?path=blog%2Fcover.jpg",
    );

    const cdn = new GitHubStorageAdapter({
      repo: "owner/repo",
      branch: "main",
      mediaPath: "public/uploads",
      token: "ghp_test",
      isPublic: true,
      publicUrlBase: "https://cdn.example.com",
      client: makeOctokit() as never,
    });
    expect(cdn.getPublicUrl("blog/cover.jpg")).toBe(
      "https://cdn.example.com/public/uploads/blog/cover.jpg",
    );
  });

  it("lists files under a folder and skips folder markers", async () => {
    const client = makeOctokit({
      getContent: vi.fn(async () => ({
        data: [
          {
            name: ".gitcms-folder",
            path: "public/uploads/blog/.gitcms-folder",
            type: "file",
            size: 0,
            sha: "x",
            download_url: null,
          },
          {
            name: "cover.jpg",
            path: "public/uploads/blog/cover.jpg",
            type: "file",
            size: 100,
            sha: "abc",
            download_url: null,
          },
          {
            name: "drafts",
            path: "public/uploads/blog/drafts",
            type: "dir",
            size: 0,
            sha: "def",
            download_url: null,
          },
        ],
      })),
    });
    const items = await makeAdapter(client).list("blog");
    expect(items.map((i) => i.path)).toEqual(["blog/cover.jpg", "blog/drafts"]);
  });
});
