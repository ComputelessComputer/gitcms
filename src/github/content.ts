import type { Octokit } from "@octokit/rest";

import type { CollectionDescriptor, GitcmsConfig } from "../config";
import { GitcmsGitHubError } from "../lib/errors";
import { parseMarkdown, serializeMarkdown } from "../lib/markdown";
import { createGitHubClient, parseGitHubRepo } from "./client";
import {
  collectionRepoPath,
  contentFileRepoPath,
  contentWorkingBranch,
  slugFromRepoPath,
} from "./content-paths";
import { ensureBranch, isGitHubStatus, openPullRequest } from "./branches";
import type {
  ContentFile,
  ContentTreeItem,
  OpenPullRequestResult,
  SaveContentParams,
  SaveContentResult,
} from "./types";

interface GitHubContentItem {
  name: string;
  path: string;
  type: "file" | "dir" | "symlink" | "submodule";
  sha: string;
  html_url: string | null;
}

interface GitHubFileContent extends GitHubContentItem {
  type: "file";
  content?: string;
  encoding?: string;
}

/** Lists markdown files in a configured collection. */
export async function listContentFiles(
  accessToken: string,
  config: GitcmsConfig,
  collectionId: string,
): Promise<ContentTreeItem[]> {
  const collection = getCollection(config, collectionId);
  const octokit = createGitHubClient(accessToken);
  const rootPath = collectionRepoPath(config.content, collection);
  return listDirectory(octokit, config, collection, rootPath);
}

/** Reads a markdown content file from GitHub and parses frontmatter. */
export async function readContentFile(
  accessToken: string,
  config: GitcmsConfig,
  params: { collectionId: string; path: string; branch?: string },
): Promise<ContentFile> {
  const collection = getCollection(config, params.collectionId);
  const branch = params.branch ?? config.content.branch;
  const file = await getFile(createGitHubClient(accessToken), config, params.path, branch);
  const decoded = decodeGitHubContent(file);
  const parsed = parseMarkdown(decoded);
  return {
    collectionId: collection.id,
    path: file.path,
    slug: slugFromRepoPath(file.path),
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    branch,
    sha: file.sha,
  };
}

/** Saves a markdown file to either the base branch or a gitcms working branch. */
export async function saveContentFile(
  accessToken: string,
  config: GitcmsConfig,
  params: SaveContentParams,
): Promise<SaveContentResult> {
  const collection = getCollection(config, params.collectionId);
  const octokit = createGitHubClient(accessToken);
  const repo = parseGitHubRepo(config.content.repo);
  const path = contentFileRepoPath(config.content, collection, params.slug);
  const branch = params.directCommit
    ? config.content.branch
    : contentWorkingBranch(config.content.workingBranchPrefix, params.slug);

  if (!params.directCommit) {
    await ensureBranch(octokit, config.content, branch);
  }

  const existingSha = await getExistingFileSha(octokit, config, path, branch);
  const content = serializeMarkdown({
    frontmatter: params.frontmatter,
    body: params.body,
  });

  const writeParams = {
    ...repo,
    path,
    branch,
    message: params.commitMessage,
    content: Buffer.from(content, "utf8").toString("base64"),
    ...(existingSha ? { sha: existingSha } : {}),
  };
  const { data } = await octokit.repos.createOrUpdateFileContents(writeParams);

  if (!data.content?.sha || !data.content.html_url) {
    throw new GitcmsGitHubError("GitHub did not return saved content metadata.");
  }

  return {
    path,
    branch,
    sha: data.content.sha,
    url: data.content.html_url,
  };
}

/** Deletes a content file from a branch. */
export async function deleteContentFile(
  accessToken: string,
  config: GitcmsConfig,
  params: { path: string; branch?: string; commitMessage: string },
): Promise<{ success: true }> {
  const branch = params.branch ?? config.content.branch;
  const octokit = createGitHubClient(accessToken);
  const repo = parseGitHubRepo(config.content.repo);
  const sha = await getExistingFileSha(octokit, config, params.path, branch);
  if (!sha) {
    return { success: true };
  }
  await octokit.repos.deleteFile({
    ...repo,
    path: params.path,
    branch,
    message: params.commitMessage,
    sha,
  });
  return { success: true };
}

/** Renames a content file by copying it to a new path and deleting the old path. */
export async function renameContentFile(
  accessToken: string,
  config: GitcmsConfig,
  params: {
    collectionId: string;
    fromPath: string;
    toSlug: string;
    branch?: string;
    commitMessage: string;
  },
): Promise<SaveContentResult> {
  const file = await readContentFile(accessToken, config, {
    collectionId: params.collectionId,
    path: params.fromPath,
    branch: params.branch,
  });
  const result = await saveContentFile(accessToken, config, {
    collectionId: params.collectionId,
    slug: params.toSlug,
    frontmatter: file.frontmatter,
    body: file.body,
    commitMessage: params.commitMessage,
    directCommit: params.branch === config.content.branch,
  });
  await deleteContentFile(accessToken, config, {
    path: params.fromPath,
    branch: result.branch,
    commitMessage: `Remove ${params.fromPath}`,
  });
  return result;
}

/** Opens a pull request for the gitcms working branch associated with a slug. */
export async function openContentPullRequest(
  accessToken: string,
  config: GitcmsConfig,
  params: { slug: string; title?: string; body?: string },
): Promise<OpenPullRequestResult> {
  const octokit = createGitHubClient(accessToken);
  const branch = contentWorkingBranch(config.content.workingBranchPrefix, params.slug);
  await ensureBranch(octokit, config.content, branch);
  return openPullRequest(octokit, config.content, {
    branch,
    title: params.title ?? `Publish ${params.slug}`,
    body: params.body ?? "Opened by gitcms.",
  });
}

function getCollection(config: GitcmsConfig, collectionId: string): CollectionDescriptor {
  const collection = config.collections.find((entry) => entry.id === collectionId);
  if (!collection) {
    throw new GitcmsGitHubError(`Unknown collection: ${collectionId}`);
  }
  return collection;
}

async function listDirectory(
  octokit: Octokit,
  config: GitcmsConfig,
  collection: CollectionDescriptor,
  path: string,
): Promise<ContentTreeItem[]> {
  const repo = parseGitHubRepo(config.content.repo);
  const response = await octokit.repos.getContent({
    ...repo,
    path,
    ref: config.content.branch,
  });

  if (!Array.isArray(response.data)) {
    return [];
  }

  const entries = response.data as GitHubContentItem[];
  const results: ContentTreeItem[] = [];
  for (const item of entries) {
    if (item.type === "dir") {
      results.push({
        collectionId: collection.id,
        path: item.path,
        name: item.name,
        type: "dir",
        sha: item.sha,
        url: item.html_url ?? "",
      });
      results.push(...(await listDirectory(octokit, config, collection, item.path)));
    } else if (item.type === "file" && /\.(md|mdx)$/i.test(item.name)) {
      results.push({
        collectionId: collection.id,
        path: item.path,
        name: item.name,
        type: "file",
        sha: item.sha,
        url: item.html_url ?? "",
      });
    }
  }

  return results;
}

async function getFile(
  octokit: Octokit,
  config: GitcmsConfig,
  path: string,
  branch: string,
): Promise<GitHubFileContent> {
  const repo = parseGitHubRepo(config.content.repo);
  const response = await octokit.repos.getContent({
    ...repo,
    path,
    ref: branch,
  });

  if (Array.isArray(response.data) || response.data.type !== "file") {
    throw new GitcmsGitHubError(`GitHub path is not a file: ${path}`);
  }

  return response.data as GitHubFileContent;
}

async function getExistingFileSha(
  octokit: Octokit,
  config: GitcmsConfig,
  path: string,
  branch: string,
): Promise<string | undefined> {
  try {
    return (await getFile(octokit, config, path, branch)).sha;
  } catch (error) {
    if (isGitHubStatus(error, 404)) {
      return undefined;
    }
    throw error;
  }
}

function decodeGitHubContent(file: GitHubFileContent): string {
  if (file.encoding !== "base64" || !file.content) {
    throw new GitcmsGitHubError(`Unsupported GitHub content encoding for ${file.path}`);
  }
  return Buffer.from(file.content.replaceAll("\n", ""), "base64").toString("utf8");
}
