import {
  createFlowPlaceholder,
  createTextPlaceholder,
  readRawMdxMetadata,
  type RawMdxAttrs,
} from "./mdx-jsx-utils";

export interface RawMdxExtraction {
  markdown: string;
  rawMdxById: ReadonlyMap<string, RawMdxAttrs>;
}

interface RawMdxRange {
  start: number;
  end: number;
  kind: "flow" | "text";
}

/** Extracts MDX-shaped JSX into placeholders so remark can parse the markdown around it. */
export function extractRawMdx(markdown: string): RawMdxExtraction {
  const codeRanges = findFencedCodeRanges(markdown);
  const flowRanges = findFlowRanges(markdown, codeRanges);
  const inlineRanges = findInlineRanges(markdown, [...codeRanges, ...flowRanges]);
  const ranges = [...flowRanges, ...inlineRanges].sort((left, right) => left.start - right.start);
  const rawMdxById = new Map<string, RawMdxAttrs>();
  let nextId = 0;
  let cursor = 0;
  let replaced = "";

  for (const range of ranges) {
    if (range.start < cursor) {
      continue;
    }

    const raw = markdown.slice(range.start, range.end);
    const id = String(nextId);
    nextId += 1;
    rawMdxById.set(id, readRawMdxMetadata(raw, range.kind));
    replaced += markdown.slice(cursor, range.start);
    replaced += range.kind === "flow" ? createFlowPlaceholder(id) : createTextPlaceholder(id);
    cursor = range.end;
  }

  replaced += markdown.slice(cursor);
  return {
    markdown: replaced,
    rawMdxById,
  };
}

function findFlowRanges(markdown: string, excludedRanges: RawMdxRange[]): RawMdxRange[] {
  const ranges: RawMdxRange[] = [];
  let offset = 0;

  for (const line of markdown.matchAll(/[^\n]*(?:\n|$)/g)) {
    const text = line[0];
    if (!text) {
      break;
    }

    if (isInsideRange(offset, excludedRanges)) {
      offset += text.length;
      continue;
    }

    const trimmedLine = text.trimEnd();
    const importExport = trimmedLine.match(/^\s*(?:import|export)\b/);
    if (importExport) {
      ranges.push({ start: offset, end: offset + trimmedLine.length, kind: "flow" });
      offset += text.length;
      continue;
    }

    const jsxStart = text.match(/^\s*<[A-Z][\w.$:-]*(?:\s|>|\/)/);
    if (jsxStart?.[0]) {
      const start = offset + text.indexOf("<");
      const end = findJsxElementEnd(markdown, start);
      if (end !== -1) {
        ranges.push({ start, end, kind: "flow" });
      }
    }

    offset += text.length;
  }

  return mergeAdjacentEsModules(ranges, markdown);
}

function findInlineRanges(markdown: string, excludedRanges: RawMdxRange[]): RawMdxRange[] {
  const ranges: RawMdxRange[] = [];
  let cursor = 0;

  while (cursor < markdown.length) {
    const start = findNextInlineStart(markdown, cursor);
    if (start === -1) {
      break;
    }

    if (isInsideRange(start, excludedRanges)) {
      cursor = start + 1;
      continue;
    }

    const end = findJsxElementEnd(markdown, start);
    if (end === -1 || isInsideRange(end - 1, excludedRanges)) {
      cursor = start + 1;
      continue;
    }

    ranges.push({ start, end, kind: "text" });
    cursor = end;
  }

  return ranges;
}

function findFencedCodeRanges(markdown: string): RawMdxRange[] {
  const ranges: RawMdxRange[] = [];
  let offset = 0;
  let fence: {
    marker: "`" | "~";
    size: number;
    start: number;
  } | null = null;

  for (const line of markdown.matchAll(/[^\n]*(?:\n|$)/g)) {
    const text = line[0];
    if (!text) {
      break;
    }

    const match = text.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (match?.[1]) {
      const marker = match[1][0] === "`" ? "`" : "~";
      if (!fence) {
        fence = {
          marker,
          size: match[1].length,
          start: offset,
        };
      } else if (fence.marker === marker && match[1].length >= fence.size) {
        ranges.push({ start: fence.start, end: offset + text.length, kind: "flow" });
        fence = null;
      }
    }

    offset += text.length;
  }

  if (fence) {
    ranges.push({ start: fence.start, end: markdown.length, kind: "flow" });
  }

  return ranges;
}

function findNextInlineStart(markdown: string, cursor: number): number {
  const match = markdown.slice(cursor).match(/<[A-Z][\w.$:-]*(?:\s|>|\/)/);
  return typeof match?.index === "number" ? cursor + match.index : -1;
}

function findJsxElementEnd(markdown: string, start: number): number {
  const opening = readJsxOpening(markdown, start);
  if (!opening) {
    return -1;
  }

  if (opening.selfClosing) {
    return opening.end;
  }

  const closingPattern = new RegExp(`</\\s*${escapeRegExp(opening.name)}\\s*>`, "g");
  closingPattern.lastIndex = opening.end;
  let depth = 1;

  while (depth > 0) {
    const nextOpening = findNextNamedOpening(markdown, opening.name, closingPattern.lastIndex);
    const nextClosing = closingPattern.exec(markdown);
    if (!nextClosing) {
      return -1;
    }

    if (nextOpening && nextOpening.start < nextClosing.index) {
      if (!nextOpening.selfClosing) {
        depth += 1;
      }
      closingPattern.lastIndex = nextOpening.end;
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return nextClosing.index + nextClosing[0].length;
    }
  }

  return -1;
}

function readJsxOpening(
  markdown: string,
  start: number,
): { name: string; end: number; selfClosing: boolean } | null {
  const nameMatch = markdown.slice(start).match(/^<\s*([A-Z][\w.$:-]*)/);
  if (!nameMatch?.[1]) {
    return null;
  }

  const tagEnd = findOpeningTagEnd(markdown, start + nameMatch[0].length);
  if (tagEnd === -1) {
    return null;
  }

  return {
    name: nameMatch[1],
    end: tagEnd + 1,
    selfClosing: /\/\s*>$/.test(markdown.slice(start, tagEnd + 1)),
  };
}

function findNextNamedOpening(
  markdown: string,
  name: string,
  cursor: number,
): { start: number; end: number; selfClosing: boolean } | null {
  const openingPattern = new RegExp(`<\\s*${escapeRegExp(name)}(?:\\s|>|/)`, "g");
  openingPattern.lastIndex = cursor;
  const match = openingPattern.exec(markdown);
  if (!match) {
    return null;
  }

  const opening = readJsxOpening(markdown, match.index);
  return opening ? { ...opening, start: match.index } : null;
}

function findOpeningTagEnd(markdown: string, start: number): number {
  let quote: '"' | "'" | null = null;
  let expressionDepth = 0;

  for (let index = start; index < markdown.length; index += 1) {
    const char = markdown[index];
    if (!char) {
      continue;
    }

    if (quote) {
      if (char === quote && markdown[index - 1] !== "\\") {
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

function isInsideRange(index: number, ranges: RawMdxRange[]): boolean {
  return ranges.some((range) => index >= range.start && index < range.end);
}

function mergeAdjacentEsModules(ranges: RawMdxRange[], markdown: string): RawMdxRange[] {
  const result: RawMdxRange[] = [];

  for (const range of ranges) {
    const previous = result.at(-1);
    if (
      previous &&
      isEsmRange(previous, markdown) &&
      isEsmRange(range, markdown) &&
      markdown.slice(previous.end, range.start).trim() === ""
    ) {
      previous.end = range.end;
      continue;
    }
    result.push({ ...range });
  }

  return result;
}

function isEsmRange(range: RawMdxRange, markdown: string): boolean {
  return /^\s*(?:import|export)\b/.test(markdown.slice(range.start, range.end));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
