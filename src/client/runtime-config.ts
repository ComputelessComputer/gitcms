import type { GitcmsConfig } from "../config";

let runtimeConfig: GitcmsConfig | null = null;

/** Stores public runtime config in the browser process. */
export function setClientRuntimeConfig(config: GitcmsConfig): void {
  runtimeConfig = config;
}

/** Returns public runtime config previously loaded by a page or query. */
export function getClientRuntimeConfig(): GitcmsConfig | null {
  return runtimeConfig;
}
