import { describe, expect, it } from "vitest";

import { SupabaseStorageAdapter } from "../../src/storage/supabase";

describe("SupabaseStorageAdapter", () => {
  it("lists files as media items", async () => {
    const adapter = new SupabaseStorageAdapter({
      url: "https://example.supabase.co",
      serviceRoleKey: "secret",
      bucket: "media",
      client: fakeSupabaseClient({
        listData: [
          {
            name: "cover.jpg",
            id: "1",
            metadata: { mimetype: "image/jpeg", size: 10 },
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          },
        ],
      }),
    });

    await expect(adapter.list("blog")).resolves.toMatchObject([
      {
        path: "blog/cover.jpg",
        name: "cover.jpg",
        folder: "blog",
        mimeType: "image/jpeg",
        publicUrl: "https://cdn.example.com/blog/cover.jpg",
      },
    ]);
  });

  it("creates signed upload descriptors", async () => {
    const adapter = new SupabaseStorageAdapter({
      url: "https://example.supabase.co",
      serviceRoleKey: "secret",
      bucket: "media",
      client: fakeSupabaseClient({ listData: [] }),
    });

    await expect(
      adapter.createSignedUpload({
        filename: "cover.jpg",
        folder: "blog",
        contentType: "image/jpeg",
      }),
    ).resolves.toMatchObject({
      uploadUrl: "https://upload.example.com",
      method: "PUT",
      storagePath: "blog/cover.jpg",
      libraryPath: "blog/cover.jpg",
    });
  });
});

function fakeSupabaseClient(params: { listData: unknown[] }) {
  return {
    storage: {
      getBucket: async () => ({ data: { name: "media" }, error: null }),
      from: () => ({
        list: async () => ({ data: params.listData, error: null }),
        createSignedUploadUrl: async () => ({
          data: { signedUrl: "https://upload.example.com" },
          error: null,
        }),
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://cdn.example.com/${path}` },
        }),
      }),
    },
  } as never;
}
