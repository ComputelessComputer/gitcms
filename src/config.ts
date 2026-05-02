import { createJiti } from "jiti";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { z } from "zod";

import { GitcmsConfigError } from "./lib/errors";

export type FieldType = "string" | "date" | "boolean" | "string-array" | "number";

export interface FieldDescriptor {
  /** User-facing form field type. */
  type: FieldType;
  /** Whether the field must be provided before save. */
  required?: boolean;
  /** Optional default value for new files. */
  default?: string | boolean | string[] | number;
  /** Optional user-facing label. */
  label?: string;
}

export interface CollectionDescriptor {
  /** Stable collection ID used in RPC input and URLs. */
  id: string;
  /** User-facing collection label. */
  label: string;
  /** Path relative to content.path in the target repository. */
  path: string;
  /** Frontmatter schema rendered by the admin UI. */
  schema: Record<string, FieldDescriptor>;
  /** Markdown parser mode. MDX is treated as markdown in v0.0.1. */
  bodyFormat: "markdown" | "mdx";
}

export interface ContentConfig {
  /** GitHub repository in owner/repo form. */
  repo: string;
  /** Base branch to read from and target PRs against. */
  branch: string;
  /** Root path inside the repository where content lives. */
  path: string;
  /** Prefix for branches created by gitcms. */
  workingBranchPrefix: string;
}

export interface GitcmsConfig {
  /** GitHub-backed content store configuration. */
  content: ContentConfig;
  /** Config-driven taxonomy rendered by the admin. */
  collections: CollectionDescriptor[];
}

const fieldDescriptorSchema = z.object({
  type: z.enum(["string", "date", "boolean", "string-array", "number"]),
  required: z.boolean().optional(),
  default: z.union([z.string(), z.boolean(), z.array(z.string()), z.number()]).optional(),
  label: z.string().optional(),
});

const configSchema = z.object({
  content: z.object({
    repo: z.string().regex(/^[^/]+\/[^/]+$/, "repo must use owner/repo format"),
    branch: z.string().min(1),
    path: z.string(),
    workingBranchPrefix: z.string().min(1),
  }),
  collections: z
    .array(
      z.object({
        id: z.string().min(1),
        label: z.string().min(1),
        path: z.string(),
        schema: z.record(z.string(), fieldDescriptorSchema),
        bodyFormat: z.enum(["markdown", "mdx"]),
      }),
    )
    .min(1),
});

/** Identity helper that gives operators typed gitcms.config.ts authoring. */
export function defineConfig(config: GitcmsConfig): GitcmsConfig {
  return config;
}

/** Validates and returns a parsed gitcms runtime config. */
export function parseGitcmsConfig(config: unknown): GitcmsConfig {
  const result = configSchema.safeParse(config);
  if (!result.success) {
    throw new GitcmsConfigError(result.error.issues.map((issue) => issue.message).join("; "));
  }
  return result.data;
}

/** Loads gitcms.config.ts or the path in GITCMS_CONFIG_PATH at runtime. */
export async function loadGitcmsConfig(
  configPath = process.env.GITCMS_CONFIG_PATH,
): Promise<GitcmsConfig> {
  const resolvedPath = path.resolve(process.cwd(), configPath || "gitcms.config.ts");
  const jiti = createJiti(pathToFileURL(import.meta.url).href);
  const loaded = await jiti.import<unknown>(resolvedPath, { default: true });
  return parseGitcmsConfig(loaded);
}
