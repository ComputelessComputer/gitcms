import type { JSONContent } from "@tiptap/react";

export const rawMdxNodeName = "rawMdx";

export type RawMdxKind = "flow" | "text";

export interface RawMdxAttrs {
  raw: string;
  kind: RawMdxKind;
  name: string;
  attributesText: string;
}

export type RawMdxPlaceholderMap = ReadonlyMap<string, RawMdxAttrs>;

const flowPrefix = "gitcms-raw-mdx-flow-";
const textPrefix = "gitcms-raw-mdx-text-";

export function createRawMdxJson(attrs: RawMdxAttrs): JSONContent {
  return {
    type: rawMdxNodeName,
    attrs,
  };
}

export function getRawMdxAttrs(node: JSONContent): RawMdxAttrs | undefined {
  if (node.type !== rawMdxNodeName) {
    return undefined;
  }

  const raw = stringAttr(node.attrs, "raw");
  const kind = stringAttr(node.attrs, "kind");
  const name = stringAttr(node.attrs, "name");
  const attributesText = stringAttr(node.attrs, "attributesText");

  if (!raw || (kind !== "flow" && kind !== "text")) {
    return undefined;
  }

  return {
    raw,
    kind,
    name: name ?? "MDX",
    attributesText: attributesText ?? "",
  };
}

export function createFlowPlaceholder(id: string): string {
  return `<!--${flowPrefix}${id}-->`;
}

export function createTextPlaceholder(id: string): string {
  return `<${textPrefix}${id} />`;
}

export function rawMdxFromHtml(
  value: string,
  rawMdxById: RawMdxPlaceholderMap,
): JSONContent | null {
  const flowId = matchWrapped(value.trim(), `<!--${flowPrefix}`, "-->");
  if (flowId) {
    return placeholderJson(flowId, "flow", rawMdxById);
  }

  const textMatch = value.trim().match(new RegExp(`^<${textPrefix}([^\\s/>]+)\\s*/>$`));
  if (textMatch?.[1]) {
    return placeholderJson(textMatch[1], "text", rawMdxById);
  }

  return null;
}

export function readRawMdxMetadata(raw: string, kind: RawMdxKind): RawMdxAttrs {
  const trimmed = raw.trimStart();
  const esmMatch = trimmed.match(/^(import|export)\b/);
  if (esmMatch?.[1]) {
    return {
      raw,
      kind,
      name: esmMatch[1],
      attributesText: "",
    };
  }

  const opening = readOpeningTag(trimmed);
  return {
    raw,
    kind,
    name: opening?.name ?? "MDX",
    attributesText: opening?.attributesText ?? "",
  };
}

function placeholderJson(
  id: string,
  expectedKind: RawMdxKind,
  rawMdxById: RawMdxPlaceholderMap,
): JSONContent | null {
  const attrs = rawMdxById.get(id);
  if (!attrs || attrs.kind !== expectedKind) {
    return null;
  }
  return createRawMdxJson(attrs);
}

function matchWrapped(value: string, prefix: string, suffix: string): string | null {
  if (!value.startsWith(prefix) || !value.endsWith(suffix)) {
    return null;
  }
  return value.slice(prefix.length, -suffix.length);
}

function readOpeningTag(raw: string): { name: string; attributesText: string } | null {
  const nameMatch = raw.match(/^<\s*([A-Z][\w.$:-]*)/);
  if (!nameMatch?.[1]) {
    return null;
  }

  const tagEnd = findOpeningTagEnd(raw, nameMatch[0].length);
  if (tagEnd === -1) {
    return {
      name: nameMatch[1],
      attributesText: "",
    };
  }

  return {
    name: nameMatch[1],
    attributesText: raw
      .slice(nameMatch[0].length, tagEnd)
      .replace(/\/\s*$/, "")
      .trim(),
  };
}

function findOpeningTagEnd(raw: string, start: number): number {
  let quote: '"' | "'" | null = null;
  let expressionDepth = 0;

  for (let index = start; index < raw.length; index += 1) {
    const char = raw[index];
    if (!char) {
      continue;
    }

    if (quote) {
      if (char === quote && raw[index - 1] !== "\\") {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === "{") {
      expressionDepth += 1;
      continue;
    }

    if (char === "}") {
      expressionDepth = Math.max(0, expressionDepth - 1);
      continue;
    }

    if (char === ">" && expressionDepth === 0) {
      return index;
    }
  }

  return -1;
}

function stringAttr(attrs: JSONContent["attrs"], key: string): string | undefined {
  const value = attrs?.[key];
  return typeof value === "string" ? value : undefined;
}
