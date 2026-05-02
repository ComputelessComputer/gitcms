import type { JSONContent } from "@tiptap/react";
import type { RootContent } from "mdast";

export interface ComponentRegistryContext {
  markdownToJson(markdown: string): JSONContent[];
  jsonToMarkdown(content: JSONContent[] | undefined): string;
}

export interface ComponentRegistryEntry {
  name: string;
  mdastToJson(node: RootContent, context: ComponentRegistryContext): JSONContent | null;
  jsonToMdast(node: JSONContent, context: ComponentRegistryContext): RootContent | null;
}

export interface ComponentRegistry {
  get(name: string): ComponentRegistryEntry | undefined;
  entries(): ComponentRegistryEntry[];
}

type MdxAttributeValue = boolean | number | string;
type MdxAttributes = Record<string, MdxAttributeValue>;

interface ParsedMdxElement {
  name: string;
  attrs: MdxAttributes;
  attributesText: string;
  children: string;
  selfClosing: boolean;
  raw: string;
  end: number;
}

type JsonAttrs = NonNullable<JSONContent["attrs"]>;

const calloutTypes = ["info", "warning", "note", "tip", "check", "danger"] as const;
type CalloutType = (typeof calloutTypes)[number];

export function createComponentRegistry(entries: ComponentRegistryEntry[] = []): ComponentRegistry {
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  return {
    get(name) {
      return byName.get(name);
    },
    entries() {
      return [...byName.values()];
    },
  };
}

const mintlifyEntries: ComponentRegistryEntry[] = [
  componentEntry("Callout", calloutToJson, calloutToMdast),
  componentEntry("Card", cardToJson, cardToMdast),
  componentEntry("Tabs", tabsToJson, tabsToMdast),
  componentEntry("Steps", stepsToJson, stepsToMdast),
  componentEntry("Accordion", accordionToJson, accordionToMdast),
  componentEntry("CodeGroup", codeGroupToJson, codeGroupToMdast),
];

export const defaultComponentRegistry = createComponentRegistry(mintlifyEntries);

function componentEntry(
  name: string,
  mdastToJson: (element: ParsedMdxElement, context: ComponentRegistryContext) => JSONContent | null,
  jsonToMdast: (node: JSONContent, context: ComponentRegistryContext) => RootContent | null,
): ComponentRegistryEntry {
  return {
    name,
    mdastToJson(node, context) {
      const raw = htmlValue(node);
      if (!raw) {
        return null;
      }

      const element = parseMdxElement(raw, name);
      return element ? mdastToJson(element, context) : null;
    },
    jsonToMdast,
  };
}

function calloutToJson(element: ParsedMdxElement, context: ComponentRegistryContext): JSONContent {
  const type = calloutTypeAttr(element.attrs, "type") ?? calloutTypeAttr(element.attrs, "variant");
  const title = stringAttr(element.attrs, "title");
  return {
    type: "mintlifyCallout",
    attrs: compactAttrs({ type: type ?? "info", title }),
    content: context.markdownToJson(element.children),
  };
}

function calloutToMdast(node: JSONContent, context: ComponentRegistryContext): RootContent | null {
  if (node.type !== "mintlifyCallout") {
    return null;
  }

  return htmlNode(
    pairedElement(
      "Callout",
      serializeAttrs([
        ["type", calloutTypeAttr(node.attrs, "type") ?? "info"],
        ["title", stringAttr(node.attrs, "title")],
      ]),
      context.jsonToMarkdown(node.content),
    ),
  );
}

function cardToJson(element: ParsedMdxElement, context: ComponentRegistryContext): JSONContent {
  return {
    type: "mintlifyCard",
    attrs: compactAttrs({
      title: stringAttr(element.attrs, "title") ?? "Card",
      href: stringAttr(element.attrs, "href"),
    }),
    content: context.markdownToJson(element.children),
  };
}

function cardToMdast(node: JSONContent, context: ComponentRegistryContext): RootContent | null {
  if (node.type !== "mintlifyCard") {
    return null;
  }

  return htmlNode(
    pairedElement(
      "Card",
      serializeAttrs([
        ["title", stringAttr(node.attrs, "title") ?? "Card"],
        ["href", stringAttr(node.attrs, "href")],
      ]),
      context.jsonToMarkdown(node.content),
    ),
  );
}

function tabsToJson(
  element: ParsedMdxElement,
  context: ComponentRegistryContext,
): JSONContent | null {
  const tabElements = findChildElements(element.children, ["Tab", "Tabs.Item"]);
  if (tabElements.length === 0) {
    return null;
  }

  return {
    type: "mintlifyTabs",
    attrs: compactAttrs({
      defaultTab:
        numberAttr(element.attrs, "defaultTab") ?? numberAttr(element.attrs, "defaultTabIndex"),
    }),
    content: tabElements.map((tab, index) => ({
      type: "mintlifyTab",
      attrs: compactAttrs({
        title: stringAttr(tab.attrs, "title") ?? `Tab ${index + 1}`,
      }),
      content: context.markdownToJson(tab.children),
    })),
  };
}

function tabsToMdast(node: JSONContent, context: ComponentRegistryContext): RootContent | null {
  if (node.type !== "mintlifyTabs") {
    return null;
  }

  const children = jsonChildren(node)
    .filter((child) => child.type === "mintlifyTab")
    .map((child) =>
      pairedElement(
        "Tab",
        serializeAttrs([["title", stringAttr(child.attrs, "title") ?? "Tab"]]),
        context.jsonToMarkdown(child.content),
      ),
    )
    .join("\n");

  return htmlNode(pairedElement("Tabs", "", children));
}

function stepsToJson(
  element: ParsedMdxElement,
  context: ComponentRegistryContext,
): JSONContent | null {
  const stepElements = findChildElements(element.children, ["Step", "Steps.Item"]);
  if (stepElements.length === 0) {
    return null;
  }

  return {
    type: "mintlifySteps",
    content: stepElements.map((step, index) => ({
      type: "mintlifyStep",
      attrs: compactAttrs({
        title: stringAttr(step.attrs, "title") ?? `Step ${index + 1}`,
      }),
      content: context.markdownToJson(step.children),
    })),
  };
}

function stepsToMdast(node: JSONContent, context: ComponentRegistryContext): RootContent | null {
  if (node.type !== "mintlifySteps") {
    return null;
  }

  const children = jsonChildren(node)
    .filter((child) => child.type === "mintlifyStep")
    .map((child) =>
      pairedElement(
        "Step",
        serializeAttrs([["title", stringAttr(child.attrs, "title") ?? "Step"]]),
        context.jsonToMarkdown(child.content),
      ),
    )
    .join("\n");

  return htmlNode(pairedElement("Steps", "", children));
}

function accordionToJson(
  element: ParsedMdxElement,
  context: ComponentRegistryContext,
): JSONContent {
  return {
    type: "mintlifyAccordion",
    attrs: compactAttrs({
      title: stringAttr(element.attrs, "title") ?? "Accordion",
      defaultOpen: booleanAttr(element.attrs, "defaultOpen") ?? false,
    }),
    content: context.markdownToJson(element.children),
  };
}

function accordionToMdast(
  node: JSONContent,
  context: ComponentRegistryContext,
): RootContent | null {
  if (node.type !== "mintlifyAccordion") {
    return null;
  }

  return htmlNode(
    pairedElement(
      "Accordion",
      serializeAttrs([
        ["title", stringAttr(node.attrs, "title") ?? "Accordion"],
        ["defaultOpen", booleanAttr(node.attrs, "defaultOpen") ? true : undefined],
      ]),
      context.jsonToMarkdown(node.content),
    ),
  );
}

function codeGroupToJson(
  element: ParsedMdxElement,
  _context: ComponentRegistryContext,
): JSONContent | null {
  const codeBlocks = findChildElements(element.children, ["CodeBlock", "CodeGroup.Code"]);
  if (codeBlocks.length === 0) {
    return null;
  }

  return {
    type: "mintlifyCodeGroup",
    content: codeBlocks.map((block, index) => ({
      type: "mintlifyCodeGroupItem",
      attrs: compactAttrs({
        title:
          stringAttr(block.attrs, "title") ??
          stringAttr(block.attrs, "filename") ??
          `Code ${index + 1}`,
        language: stringAttr(block.attrs, "language") ?? stringAttr(block.attrs, "lang"),
        code: trimOuterBlankLines(block.children),
      }),
    })),
  };
}

function codeGroupToMdast(
  node: JSONContent,
  _context: ComponentRegistryContext,
): RootContent | null {
  if (node.type !== "mintlifyCodeGroup") {
    return null;
  }

  const children = jsonChildren(node)
    .filter((child) => child.type === "mintlifyCodeGroupItem")
    .map((child) =>
      pairedElement(
        "CodeBlock",
        serializeAttrs([
          ["title", stringAttr(child.attrs, "title") ?? "Code"],
          ["language", stringAttr(child.attrs, "language")],
        ]),
        stringAttr(child.attrs, "code") ?? "",
      ),
    )
    .join("\n");

  return htmlNode(pairedElement("CodeGroup", "", children));
}

function htmlValue(node: RootContent): string | null {
  return node.type === "html" ? node.value : null;
}

function htmlNode(value: string): RootContent {
  return { type: "html", value };
}

function pairedElement(name: string, serializedAttrs: string, children: string): string {
  const body = children.trimEnd();
  return body
    ? `<${name}${serializedAttrs}>\n${body}\n</${name}>`
    : `<${name}${serializedAttrs}></${name}>`;
}

function serializeAttrs(entries: [string, MdxAttributeValue | undefined][]): string {
  const serialized = entries
    .flatMap(([key, value]) => {
      if (typeof value === "undefined" || value === false || value === "") {
        return [];
      }
      if (value === true) {
        return `${key}={true}`;
      }
      if (typeof value === "number") {
        return `${key}={${value}}`;
      }
      return `${key}="${escapeAttribute(value)}"`;
    })
    .join(" ");

  return serialized ? ` ${serialized}` : "";
}

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function compactAttrs(attrs: JsonAttrs): JsonAttrs {
  return Object.fromEntries(
    Object.entries(attrs).filter((entry): entry is [string, MdxAttributeValue] => {
      const value = entry[1];
      return typeof value === "string" || typeof value === "boolean" || typeof value === "number";
    }),
  );
}

function jsonChildren(node: JSONContent): JSONContent[] {
  return node.content ?? [];
}

function stringAttr(
  attrs: JSONContent["attrs"] | MdxAttributes | undefined,
  key: string,
): string | undefined {
  const value = attrs?.[key];
  return typeof value === "string" ? value : undefined;
}

function numberAttr(
  attrs: JSONContent["attrs"] | MdxAttributes | undefined,
  key: string,
): number | undefined {
  const value = attrs?.[key];
  return typeof value === "number" ? value : undefined;
}

function booleanAttr(
  attrs: JSONContent["attrs"] | MdxAttributes | undefined,
  key: string,
): boolean | undefined {
  const value = attrs?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function calloutTypeAttr(
  attrs: JSONContent["attrs"] | MdxAttributes | undefined,
  key: string,
): CalloutType | undefined {
  const value = stringAttr(attrs, key);
  return calloutTypes.find((type) => type === value);
}

function parseMdxElement(raw: string, expectedName?: string): ParsedMdxElement | null {
  const start = raw.search(/<\s*[A-Z][\w.$:-]*/);
  if (start === -1) {
    return null;
  }

  const element = readMdxElementAt(raw, start);
  if (!element || element.raw.trim() !== raw.trim()) {
    return null;
  }
  if (expectedName && element.name !== expectedName) {
    return null;
  }
  return element;
}

function findChildElements(markdown: string, names: readonly string[]): ParsedMdxElement[] {
  const children: ParsedMdxElement[] = [];
  let cursor = 0;

  while (cursor < markdown.length) {
    const start = findNextChildStart(markdown, cursor, names);
    if (start === -1) {
      break;
    }

    const element = readMdxElementAt(markdown, start);
    if (!element) {
      cursor = start + 1;
      continue;
    }

    if (names.includes(element.name)) {
      children.push(element);
    }
    cursor = element.end;
  }

  return children;
}

function findNextChildStart(markdown: string, cursor: number, names: readonly string[]): number {
  let best = -1;
  for (const name of names) {
    const pattern = new RegExp(`<\\s*${escapeRegExp(name)}(?:\\s|>|/)`, "g");
    pattern.lastIndex = cursor;
    const match = pattern.exec(markdown);
    if (typeof match?.index === "number" && (best === -1 || match.index < best)) {
      best = match.index;
    }
  }
  return best;
}

function readMdxElementAt(markdown: string, start: number): ParsedMdxElement | null {
  const nameMatch = markdown.slice(start).match(/^<\s*([A-Z][\w.$:-]*)/);
  if (!nameMatch?.[1]) {
    return null;
  }

  const openingStartLength = nameMatch[0].length;
  const openingEnd = findOpeningTagEnd(markdown, start + openingStartLength);
  if (openingEnd === -1) {
    return null;
  }

  const rawOpening = markdown.slice(start, openingEnd + 1);
  const selfClosing = /\/\s*>$/.test(rawOpening);
  const attributesText = markdown
    .slice(start + openingStartLength, openingEnd)
    .replace(/\/\s*$/, "")
    .trim();

  if (selfClosing) {
    return {
      name: nameMatch[1],
      attrs: parseAttributes(attributesText),
      attributesText,
      children: "",
      selfClosing: true,
      raw: markdown.slice(start, openingEnd + 1),
      end: openingEnd + 1,
    };
  }

  const closing = findClosingTag(markdown, nameMatch[1], openingEnd + 1);
  if (!closing) {
    return null;
  }

  return {
    name: nameMatch[1],
    attrs: parseAttributes(attributesText),
    attributesText,
    children: markdown.slice(openingEnd + 1, closing.start),
    selfClosing: false,
    raw: markdown.slice(start, closing.end),
    end: closing.end,
  };
}

function findClosingTag(
  markdown: string,
  name: string,
  cursor: number,
): { start: number; end: number } | null {
  const closingPattern = new RegExp(`</\\s*${escapeRegExp(name)}\\s*>`, "g");
  closingPattern.lastIndex = cursor;
  let depth = 1;

  while (depth > 0) {
    const nextOpening = findNextNamedOpening(markdown, name, closingPattern.lastIndex);
    const nextClosing = closingPattern.exec(markdown);
    if (!nextClosing) {
      return null;
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
      return {
        start: nextClosing.index,
        end: nextClosing.index + nextClosing[0].length,
      };
    }
  }

  return null;
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

  const openingEnd = findOpeningTagEnd(markdown, match.index + match[0].length);
  if (openingEnd === -1) {
    return null;
  }

  return {
    start: match.index,
    end: openingEnd + 1,
    selfClosing: /\/\s*>$/.test(markdown.slice(match.index, openingEnd + 1)),
  };
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

function parseAttributes(source: string): MdxAttributes {
  const attrs: MdxAttributes = {};
  let cursor = 0;

  while (cursor < source.length) {
    cursor = skipWhitespace(source, cursor);
    const nameMatch = source.slice(cursor).match(/^([A-Za-z_:][\w:.-]*)/);
    if (!nameMatch?.[1]) {
      break;
    }

    const name = nameMatch[1];
    cursor += name.length;
    cursor = skipWhitespace(source, cursor);

    if (source[cursor] !== "=") {
      attrs[name] = true;
      continue;
    }

    cursor += 1;
    cursor = skipWhitespace(source, cursor);
    const parsed = readAttributeValue(source, cursor);
    if (!parsed) {
      break;
    }

    attrs[name] = parsed.value;
    cursor = parsed.end;
  }

  return attrs;
}

function readAttributeValue(
  source: string,
  cursor: number,
): { value: MdxAttributeValue; end: number } | null {
  const quote = source[cursor];
  if (quote === '"' || quote === "'") {
    const end = source.indexOf(quote, cursor + 1);
    if (end === -1) {
      return null;
    }
    return {
      value: decodeAttribute(source.slice(cursor + 1, end)),
      end: end + 1,
    };
  }

  if (quote === "{") {
    const end = findExpressionEnd(source, cursor);
    if (end === -1) {
      return null;
    }
    return {
      value: expressionValue(source.slice(cursor + 1, end)),
      end: end + 1,
    };
  }

  const match = source.slice(cursor).match(/^[^\s]+/);
  if (!match?.[0]) {
    return null;
  }

  return {
    value: decodeAttribute(match[0]),
    end: cursor + match[0].length,
  };
}

function findExpressionEnd(source: string, start: number): number {
  let depth = 0;
  let quote: '"' | "'" | "`" | null = null;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (!char) {
      continue;
    }

    if (quote) {
      if (char === quote && source[index - 1] !== "\\") {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
      continue;
    }

    if (char === "{") {
      depth += 1;
      continue;
    }

    if (char === "}") {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function expressionValue(source: string): MdxAttributeValue {
  const value = source.trim();
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  const numeric = Number(value);
  if (value !== "" && Number.isFinite(numeric)) {
    return numeric;
  }
  return value;
}

function decodeAttribute(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

function skipWhitespace(source: string, cursor: number): number {
  let next = cursor;
  while (/\s/.test(source[next] ?? "")) {
    next += 1;
  }
  return next;
}

function trimOuterBlankLines(value: string): string {
  return value.replace(/^\s*\n/, "").replace(/\n\s*$/, "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
