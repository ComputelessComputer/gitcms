import type { Octokit } from "@octokit/rest";

import type { ContentConfig } from "../config";
import { GitcmsGitHubError } from "../lib/errors";
import { parseGitHubRepo } from "./client";
import type { OpenPullRequestResult } from "./types";

/** Returns the commit SHA at the tip of a branch. */
export async function getBranchHeadSha(
  octokit: Octokit,
  content: ContentConfig,
  branch: string,
): Promise<string> {
  const repo = parseGitHubRepo(content.repo);
  const { data } = await octokit.git.getRef({
    ...repo,
    ref: `heads/${branch}`,
  });
  return data.object.sha;
}

/** Ensures a branch exists, creating it from the configured base branch when needed. */
export async function ensureBranch(
  octokit: Octokit,
  content: ContentConfig,
  branch: string,
): Promise<void> {
  const repo = parseGitHubRepo(content.repo);
  try {
    await octokit.git.getRef({ ...repo, ref: `heads/${branch}` });
    return;
  } catch (error) {
    if (!isGitHubStatus(error, 404)) {
      throw error;
    }
  }

  const baseSha = await getBranchHeadSha(octokit, content, content.branch);
  await octokit.git.createRef({
    ...repo,
    ref: `refs/heads/${branch}`,
    sha: baseSha,
  });
}

/** Opens or returns a pull request from a working branch to the base branch. */
export async function openPullRequest(
  octokit: Octokit,
  content: ContentConfig,
  params: {
    branch: string;
    title: string;
    body?: string;
  },
): Promise<OpenPullRequestResult> {
  const repo = parseGitHubRepo(content.repo);
  const existing = await octokit.pulls.list({
    ...repo,
    head: `${repo.owner}:${params.branch}`,
    base: content.branch,
    state: "open",
  });

  const existingPull = existing.data[0];
  if (existingPull) {
    return { number: existingPull.number, url: existingPull.html_url };
  }

  const createParams = {
    ...repo,
    head: params.branch,
    base: content.branch,
    title: params.title,
    ...(params.body ? { body: params.body } : {}),
  };
  const { data } = await octokit.pulls.create(createParams);

  if (!data.html_url) {
    throw new GitcmsGitHubError("GitHub did not return a pull request URL.");
  }

  return { number: data.number, url: data.html_url };
}

/** Returns true when an Octokit error has a specific HTTP status. */
export function isGitHubStatus(error: unknown, status: number): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    (error as { status?: unknown }).status === status
  );
}
