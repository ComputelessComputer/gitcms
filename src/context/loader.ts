import type { GitcmsConfig } from "../config";
import { readRepoFileText } from "../github/content";
import { collectionVoicePath, repoContextPath, repoVoicePath } from "./paths";

/** The merged author-writing brief surfaced to humans (in the editor) and
 *  AI agents (via /api/context). All fields are nullable when the underlying
 *  file is missing — callers should treat null as "operator hasn't set it yet."
 *
 *  The `merged` field is the flattened brief intended to be dropped into an
 *  agent's system prompt verbatim. Order: repo context → repo voice →
 *  collection voice. Section headers added between non-empty parts so the
 *  agent can tell where the override is coming from. */
export interface AuthorContext {
  /** repo-level `<content>/.gitcms/context.md` — company/brand/audience. */
  context: string | null;
  /** repo-level `<content>/.gitcms/voice.md` — tone/style/voice. */
  voice: string | null;
  /** collection-level `<content>/<collection>/.gitcms/voice.md` — overrides. */
  collectionVoice: string | null;
  /** Flattened brief, ready to inject into a system prompt. Empty string when
   *  no parts are present. */
  merged: string;
}

export interface LoadAuthorContextOptions {
  /** When set, also reads `<content>/<collection>/.gitcms/voice.md`. */
  collectionId?: string;
  /** GitHub branch to read from. Defaults to `content.branch`. */
  branch?: string;
}

/** Loads the author-writing brief for the configured content repo.
 *
 *  Reads up to three markdown files from GitHub:
 *    - <content>/.gitcms/context.md          (company/brand)
 *    - <content>/.gitcms/voice.md            (repo voice)
 *    - <content>/<collection>/.gitcms/voice.md   (collection override, optional)
 *
 *  Each is independent — a 404 on one does not break the others. The `merged`
 *  field stitches them together with simple section markers so consumers don't
 *  have to. */
export async function loadAuthorContext(
  accessToken: string,
  config: GitcmsConfig,
  options: LoadAuthorContextOptions = {},
): Promise<AuthorContext> {
  const branch = options.branch;
  const collection = options.collectionId
    ? (config.collections.find((c) => c.id === options.collectionId) ?? null)
    : null;

  const reads: Array<Promise<string | null>> = [
    readRepoFileText(accessToken, config, repoContextPath(config.content), branch),
    readRepoFileText(accessToken, config, repoVoicePath(config.content), branch),
    collection
      ? readRepoFileText(
          accessToken,
          config,
          collectionVoicePath(config.content, collection),
          branch,
        )
      : Promise.resolve(null),
  ];

  const results = await Promise.all(reads);
  const context = results[0] ?? null;
  const voice = results[1] ?? null;
  const collectionVoice = results[2] ?? null;

  return {
    context: nullIfBlank(context),
    voice: nullIfBlank(voice),
    collectionVoice: nullIfBlank(collectionVoice),
    merged: mergeAuthorContext({
      context,
      voice,
      collectionVoice,
      collectionLabel: collection?.label ?? collection?.id ?? null,
    }),
  };
}

/** Stitches the three brief parts into a single string. Pure — exported for
 *  tests and for callers who already have the parts in memory. */
export function mergeAuthorContext(parts: {
  context: string | null;
  voice: string | null;
  collectionVoice: string | null;
  collectionLabel: string | null;
}): string {
  const sections: string[] = [];
  if (parts.context && parts.context.trim()) {
    sections.push(`# Brand & audience context\n\n${parts.context.trim()}`);
  }
  if (parts.voice && parts.voice.trim()) {
    sections.push(`# Voice & style\n\n${parts.voice.trim()}`);
  }
  if (parts.collectionVoice && parts.collectionVoice.trim()) {
    const heading = parts.collectionLabel
      ? `# Voice & style — ${parts.collectionLabel}`
      : "# Voice & style — collection override";
    sections.push(`${heading}\n\n${parts.collectionVoice.trim()}`);
  }
  return sections.join("\n\n");
}

function nullIfBlank(value: string | null): string | null {
  if (value === null) return null;
  return value.trim() === "" ? null : value;
}
