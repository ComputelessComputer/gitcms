import { loadGitcmsConfig, type CollectionDescriptor, type GitcmsConfig } from "../config";

let configPromise: Promise<GitcmsConfig> | null = null;

/** Loads and caches gitcms.config.ts for the current server process. */
export function getRuntimeConfig(): Promise<GitcmsConfig> {
  configPromise ??= loadGitcmsConfig();
  return configPromise;
}

/** Returns a configured collection or throws when the ID is unknown. */
export async function getCollection(collectionId: string): Promise<CollectionDescriptor> {
  const config = await getRuntimeConfig();
  const collection = config.collections.find((entry) => entry.id === collectionId);
  if (!collection) {
    throw new Error(`Unknown collection: ${collectionId}`);
  }
  return collection;
}

/** Resets the runtime config singleton for tests. */
export function resetRuntimeConfigForTests(): void {
  configPromise = null;
}
