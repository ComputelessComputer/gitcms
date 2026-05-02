import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAdminServerFn } from "../../auth/require-admin";
import { splitMediaPath } from "../../storage/path";
import { getStorageAdapter } from "../../storage";

/** Lists media files in a folder. */
export const mediaList = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      folder: z.string().default(""),
      recursive: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdminServerFn();
    const adapter = await getStorageAdapter();
    const options = data.recursive === undefined ? {} : { recursive: data.recursive };
    return { items: await adapter.list(data.folder, options) };
  });

/** Creates a signed upload URL for direct browser media upload. */
export const mediaCreateSignedUpload = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      filename: z.string().min(1),
      folder: z.string().optional(),
      contentType: z.string().min(1),
      upsert: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdminServerFn();
    const adapter = await getStorageAdapter();
    return adapter.createSignedUpload(data);
  });

/** Registers a media file after a successful direct upload. */
export const mediaRegister = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      path: z.string().min(1),
      mimeType: z.string().min(1),
      size: z.number().nonnegative(),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdminServerFn();
    const adapter = await getStorageAdapter();
    return {
      item: {
        path: data.path,
        ...splitMediaPath(data.path),
        mimeType: data.mimeType,
        size: data.size,
        publicUrl: adapter.getPublicUrl(data.path),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    };
  });

/** Moves or renames a media file. */
export const mediaMove = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      fromPath: z.string().min(1),
      toPath: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdminServerFn();
    const adapter = await getStorageAdapter();
    return { item: await adapter.move(data.fromPath, data.toPath) };
  });

/** Deletes one or more media files. */
export const mediaDelete = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      paths: z.array(z.string().min(1)).min(1),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdminServerFn();
    const adapter = await getStorageAdapter();
    const deleted: string[] = [];
    for (const path of data.paths) {
      const nested = await adapter.list(path, { recursive: true }).catch(() => []);
      for (const item of nested) {
        if (await adapter.delete(item.path)) {
          deleted.push(item.path);
        }
      }
      if (await adapter.delete(path)) {
        deleted.push(path);
      }
      if (await adapter.delete(`${path}/.gitcms-folder`)) {
        deleted.push(`${path}/.gitcms-folder`);
      }
    }
    return { deleted };
  });

/** Creates a media folder. */
export const mediaCreateFolder = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      path: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    await requireAdminServerFn();
    const adapter = await getStorageAdapter();
    await adapter.createFolder(data.path);
    return { path: data.path };
  });
