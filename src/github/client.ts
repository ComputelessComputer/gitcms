import { Octokit } from "@octokit/rest";

import { GitcmsConfigError } from "../lib/errors";
import type { GitHubRepoRef } from "./types";

/** Creates an authenticated Octokit REST client. */
export function createGitHubClient(accessToken: string): Octokit {
  return new Octokit({
    auth: accessToken,
    userAgent: "gitcms/0.0.1",
  });
}

/** Parses an owner/repo string into Octokit parameters. */
export function parseGitHubRepo(value: string): GitHubRepoRef {
  const [owner, repo] = value.split("/");
  if (!owner || !repo) {
    throw new GitcmsConfigError(`Invalid GitHub repository: ${value}`);
  }
  return { owner, repo };
}
