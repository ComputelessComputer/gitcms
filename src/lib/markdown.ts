import { load, dump } from "js-yaml";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonRecord = { [key: string]: JsonValue };

export interface ParsedMarkdown {
  /** YAML frontmatter parsed as JSON-safe data. */
  frontmatter: JsonRecord;
  /** Markdown body without frontmatter fences. */
  body: string;
}

function toJsonValue(value: unknown): JsonValue {
  if (value === null) return null;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((entry) => toJsonValue(entry));
  }
  if (typeof value === "object") {
    const record: JsonRecord = {};
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      record[key] = toJsonValue(entry);
    }
    return record;
  }
  return String(value);
}

/** Parses YAML frontmatter and markdown body from a source string. */
export function parseMarkdown(source: string): ParsedMarkdown {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: source };
  }

  const frontmatterSource = match[1] ?? "";
  const body = match[2] ?? "";
  const loaded = load(frontmatterSource);
  const frontmatter = typeof loaded === "object" && loaded !== null ? toJsonValue(loaded) : {};
  if (!frontmatter || Array.isArray(frontmatter) || typeof frontmatter !== "object") {
    return { frontmatter: {}, body };
  }

  return { frontmatter: frontmatter as JsonRecord, body };
}

/** Serializes YAML frontmatter and markdown body into a repository file. */
export function serializeMarkdown(parsed: ParsedMarkdown): string {
  const frontmatter = dump(parsed.frontmatter, {
    forceQuotes: false,
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    sortKeys: true,
  }).trim();
  const body = parsed.body.trimStart();
  return `---\n${frontmatter}\n---\n\n${body}`;
}

/** Normalizes markdown through the parse/serialize frontmatter path. */
export function roundTripMarkdown(source: string): string {
  return serializeMarkdown(parseMarkdown(source));
}
