import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireAdminServerFn } from "../../auth/require-admin";
import {
  deleteContentFile,
  listContentFiles,
  openContentPullRequest,
  readContentFile,
  renameContentFile,
  saveContentFile,
} from "../../github/content";
import { createGitHubClient } from "../../github/client";
import { ensureBranch } from "../../github/branches";
import { contentWorkingBranch } from "../../github/content-paths";
import type { JsonValue } from "../../lib/markdown";
import { getRuntimeConfig } from "../runtime-config";

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]),
);

const jsonRecordSchema = z.record(z.string(), jsonValueSchema);

/** Lists content files for a configured collection. */
export const contentList = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      collectionId: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdminServerFn();
    const config = await getRuntimeConfig();
    return { items: await listContentFiles(admin.accessToken, config, data.collectionId) };
  });

/** Reads a content file from GitHub. */
export const contentRead = createServerFn({ method: "GET" })
  .inputValidator(
    z.object({
      collectionId: z.string().min(1),
      path: z.string().min(1),
      branch: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdminServerFn();
    const config = await getRuntimeConfig();
    return readContentFile(admin.accessToken, config, data);
  });

/** Saves a content file to GitHub. */
export const contentSave = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      collectionId: z.string().min(1),
      slug: z.string().min(1),
      frontmatter: jsonRecordSchema,
      body: z.string(),
      commitMessage: z.string().min(1),
      directCommit: z.boolean().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdminServerFn();
    const config = await getRuntimeConfig();
    return saveContentFile(admin.accessToken, config, data);
  });

/** Renames a content file. */
export const contentRename = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      collectionId: z.string().min(1),
      fromPath: z.string().min(1),
      toSlug: z.string().min(1),
      branch: z.string().optional(),
      commitMessage: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdminServerFn();
    const config = await getRuntimeConfig();
    return renameContentFile(admin.accessToken, config, data);
  });

/** Deletes a content file. */
export const contentDelete = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      path: z.string().min(1),
      branch: z.string().optional(),
      commitMessage: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdminServerFn();
    const config = await getRuntimeConfig();
    return deleteContentFile(admin.accessToken, config, data);
  });

/** Creates the gitcms working branch for a slug. */
export const contentCreateBranch = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      slug: z.string().min(1),
    }),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdminServerFn();
    const config = await getRuntimeConfig();
    const branch = contentWorkingBranch(config.content.workingBranchPrefix, data.slug);
    await ensureBranch(createGitHubClient(admin.accessToken), config.content, branch);
    return { branch };
  });

/** Opens a GitHub pull request from a gitcms working branch. */
export const contentOpenPR = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      slug: z.string().min(1),
      title: z.string().optional(),
      body: z.string().optional(),
    }),
  )
  .handler(async ({ data }) => {
    const admin = await requireAdminServerFn();
    const config = await getRuntimeConfig();
    return openContentPullRequest(admin.accessToken, config, data);
  });
