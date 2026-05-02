import type { JsonRecord } from "../lib/markdown";

export interface GitHubRepoRef {
  /** Repository owner. */
  owner: string;
  /** Repository name. */
  repo: string;
}

export interface ContentTreeItem {
  /** Collection ID this file belongs to. */
  collectionId: string;
  /** Repository-relative path. */
  path: string;
  /** Filename or folder name. */
  name: string;
  /** GitHub object type. */
  type: "file" | "dir";
  /** Git object SHA. */
  sha: string;
  /** GitHub web URL. */
  url: string;
}

export interface ContentFile {
  /** Collection ID this file belongs to. */
  collectionId: string;
  /** Repository-relative path. */
  path: string;
  /** Filename slug without extension. */
  slug: string;
  /** Frontmatter parsed from the file. */
  frontmatter: JsonRecord;
  /** Markdown body without frontmatter. */
  body: string;
  /** Source branch. */
  branch: string;
  /** Git object SHA. */
  sha: string;
}

export interface SaveContentParams {
  /** Collection ID. */
  collectionId: string;
  /** Filename slug without extension. */
  slug: string;
  /** Frontmatter to serialize. */
  frontmatter: JsonRecord;
  /** Markdown body. */
  body: string;
  /** Commit message. */
  commitMessage: string;
  /** Save directly to base branch instead of a working branch. */
  directCommit?: boolean;
}

export interface SaveContentResult {
  /** Repository-relative path that was written. */
  path: string;
  /** Branch that received the commit. */
  branch: string;
  /** New Git blob SHA. */
  sha: string;
  /** GitHub web URL. */
  url: string;
}

export interface OpenPullRequestResult {
  /** Pull request number. */
  number: number;
  /** GitHub web URL. */
  url: string;
}
