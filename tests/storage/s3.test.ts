import { PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { describe, expect, it, vi } from "vitest";

import { S3StorageAdapter } from "../../src/storage/s3";

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: vi.fn(async () => "https://upload.example.com/signed"),
}));

describe("S3StorageAdapter", () => {
  it("creates signed PUT uploads", async () => {
    const sent: unknown[] = [];
    const adapter = new S3StorageAdapter({
      region: "us-east-1",
      bucket: "media",
      accessKeyId: "key",
      secretAccessKey: "secret",
      publicUrlBase: "https://cdn.example.com",
      client: { send: async (command: unknown) => sent.push(command) } as never,
    });

    const result = await adapter.createSignedUpload({
      filename: "cover.jpg",
      folder: "blog",
      contentType: "image/jpeg",
    });

    expect(getSignedUrl).toHaveBeenCalled();
    expect(result).toEqual({
      uploadUrl: "https://upload.example.com/signed",
      method: "PUT",
      headers: { "content-type": "image/jpeg" },
      storagePath: "blog/cover.jpg",
      libraryPath: "blog/cover.jpg",
    });
  });

  it("lists objects as media items", async () => {
    const adapter = new S3StorageAdapter({
      region: "us-east-1",
      bucket: "media",
      accessKeyId: "key",
      secretAccessKey: "secret",
      publicUrlBase: "https://cdn.example.com",
      client: {
        send: async (command: unknown) => {
          expect(command).toBeInstanceOf(ListObjectsV2Command);
          return {
            Contents: [
              {
                Key: "blog/cover.jpg",
                Size: 10,
                LastModified: new Date("2026-01-01T00:00:00.000Z"),
              },
            ],
          };
        },
      } as never,
    });

    await expect(adapter.list("blog")).resolves.toMatchObject([
      {
        path: "blog/cover.jpg",
        name: "cover.jpg",
        folder: "blog",
        publicUrl: "https://cdn.example.com/blog/cover.jpg",
      },
    ]);
  });

  it("uses PutObjectCommand for signed uploads", async () => {
    await new S3StorageAdapter({
      region: "us-east-1",
      bucket: "media",
      accessKeyId: "key",
      secretAccessKey: "secret",
      client: { send: async () => ({}) } as never,
    }).createSignedUpload({ filename: "x.png", contentType: "image/png" });

    const command = vi.mocked(getSignedUrl).mock.calls.at(-1)?.[1];
    expect(command).toBeInstanceOf(PutObjectCommand);
  });
});
