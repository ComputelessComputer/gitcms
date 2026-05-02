import type { CollectionDescriptor, ContentConfig, GitcmsConfig } from "../config";
import { normalizeRepoPath } from "../github/content-paths";

/** Directory inside the content tree where author-context lives. */
export const AUTHOR_CONTEXT_DIR = ".gitcms";

/** Filename of the company / brand / audience context. */
export const CONTEXT_FILENAME = "context.md";

/** Filename of the voice / tone / style brief. */
export const VOICE_FILENAME = "voice.md";

/** Repo path: `<content.path>/.gitcms/context.md`. */
export function repoContextPath(content: ContentConfig): string {
  return normalizeRepoPath(`${content.path}/${AUTHOR_CONTEXT_DIR}/${CONTEXT_FILENAME}`);
}

/** Repo path: `<content.path>/.gitcms/voice.md`. */
export function repoVoicePath(content: ContentConfig): string {
  return normalizeRepoPath(`${content.path}/${AUTHOR_CONTEXT_DIR}/${VOICE_FILENAME}`);
}

/** Repo path: `<content.path>/<collection.path>/.gitcms/voice.md`. */
export function collectionVoicePath(
  content: ContentConfig,
  collection: CollectionDescriptor,
): string {
  return normalizeRepoPath(
    [content.path, collection.path, AUTHOR_CONTEXT_DIR, VOICE_FILENAME].filter(Boolean).join("/"),
  );
}

/** Returns every author-context path that may exist for a config + optional collection. */
export function listAuthorContextPaths(
  config: GitcmsConfig,
  collectionId?: string,
): { repoContext: string; repoVoice: string; collectionVoice: string | null } {
  const collection = collectionId
    ? (config.collections.find((c) => c.id === collectionId) ?? null)
    : null;
  return {
    repoContext: repoContextPath(config.content),
    repoVoice: repoVoicePath(config.content),
    collectionVoice: collection ? collectionVoicePath(config.content, collection) : null,
  };
}
