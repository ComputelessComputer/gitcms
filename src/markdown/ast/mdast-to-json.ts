import type { JSONContent } from "@tiptap/react";
import type {
  AlignType,
  BlockContent,
  DefinitionContent,
  ListItem,
  PhrasingContent,
  Root,
  RootContent,
  TableCell,
  TableRow,
} from "mdast";

import {
  defaultComponentRegistry,
  type ComponentRegistry,
  type ComponentRegistryContext,
} from "../component-registry";
import {
  getRawMdxAttrs,
  rawMdxNodeName,
  rawMdxFromHtml,
  type RawMdxPlaceholderMap,
} from "./mdx-jsx-utils";
import { parseMarkdownAst } from "./markdown-processor";
import { extractRawMdx } from "./raw-mdx-extract";

type JsonAttrs = NonNullable<JSONContent["attrs"]>;
type JsonMark = NonNullable<JSONContent["marks"]>[number];

interface MdastToJsonOptions {
  rawMdxById?: RawMdxPlaceholderMap;
  componentRegistry?: ComponentRegistry;
}

/** Converts a remark/mdast tree into Tiptap JSONContent. */
export function mdastToJson(tree: Root, options: MdastToJsonOptions = {}): JSONContent {
  return {
    type: "doc",
    content: tree.children.flatMap((child) => rootContentToJson(child, options)),
  };
}

function rootContentToJson(node: RootContent, options: MdastToJsonOptions): JSONContent[] {
  switch (node.type) {
    case "paragraph":
      return [paragraphJson(node.children, options)];
    case "heading":
      return [
        {
          type: "heading",
          attrs: { level: node.depth },
          content: phrasingToJson(node.children, options),
        },
      ];
    case "blockquote":
      return [
        {
          type: "blockquote",
          content: node.children.flatMap((child) => blockContentToJson(child, options)),
        },
      ];
    case "list":
      return [
        {
          type: node.ordered ? "orderedList" : "bulletList",
          attrs: listAttrs(node.start ?? undefined),
          content: node.children.map((child) => listItemToJson(child, options)),
        },
      ];
    case "code":
      return [
        {
          type: "codeBlock",
          attrs: codeAttrs(node.lang ?? undefined, node.meta ?? undefined),
          content: node.value ? [{ type: "text", text: node.value }] : undefined,
        },
      ];
    case "thematicBreak":
      return [{ type: "horizontalRule" }];
    case "table":
      return [
        {
          type: "table",
          attrs: tableAttrs(node.align ?? undefined),
          content: node.children.map((row, index) => tableRowToJson(row, index === 0, options)),
        },
      ];
    case "break":
    case "delete":
    case "emphasis":
    case "footnoteReference":
    case "image":
    case "imageReference":
    case "inlineCode":
    case "link":
    case "linkReference":
    case "strong":
    case "text":
      return [paragraphJson([node], options)];
    case "html":
      return htmlToJson(node.value, options, "flow");
    case "definition":
      return [paragraphJson([{ type: "text", value: definitionSource(node.identifier) }], options)];
    case "footnoteDefinition":
      return [
        paragraphJson(
          [{ type: "text", value: footnoteDefinitionSource(node.identifier) }],
          options,
        ),
        ...node.children.flatMap((child) => blockContentToJson(child, options)),
      ];
    case "listItem":
      return [listItemToJson(node, options)];
    case "tableCell":
      return [paragraphJson(node.children, options)];
    case "tableRow":
      return [tableRowToJson(node, false, options)];
    case "yaml":
      return [];
    default:
      return [];
  }
}

function blockContentToJson(
  node: BlockContent | DefinitionContent,
  options: MdastToJsonOptions,
): JSONContent[] {
  return rootContentToJson(node, options);
}

function paragraphJson(children: PhrasingContent[], options: MdastToJsonOptions): JSONContent {
  const content = phrasingToJson(children, options);
  return {
    type: "paragraph",
    content: content.length > 0 ? content : undefined,
  };
}

function listItemToJson(node: ListItem, options: MdastToJsonOptions): JSONContent {
  const attrs: JsonAttrs = {};
  if (typeof node.checked === "boolean") {
    attrs.checked = node.checked;
  }
  if (node.spread) {
    attrs.spread = true;
  }

  const content = node.children.flatMap((child) => blockContentToJson(child, options));
  return {
    type: "listItem",
    attrs: Object.keys(attrs).length > 0 ? attrs : undefined,
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
}

function tableRowToJson(node: TableRow, header: boolean, options: MdastToJsonOptions): JSONContent {
  return {
    type: "tableRow",
    content: node.children.map((cell) => tableCellToJson(cell, header, options)),
  };
}

function tableCellToJson(
  node: TableCell,
  header: boolean,
  options: MdastToJsonOptions,
): JSONContent {
  const content = phrasingToJson(node.children, options);
  return {
    type: header ? "tableHeader" : "tableCell",
    content: [{ type: "paragraph", content: content.length > 0 ? content : undefined }],
  };
}

function phrasingToJson(children: PhrasingContent[], options: MdastToJsonOptions): JSONContent[] {
  return children.flatMap((child) => phrasingChildToJson(child, options));
}

function phrasingChildToJson(node: PhrasingContent, options: MdastToJsonOptions): JSONContent[] {
  switch (node.type) {
    case "text":
      return textJson(node.value);
    case "emphasis":
      return withMark(phrasingToJson(node.children, options), { type: "italic" });
    case "strong":
      return withMark(phrasingToJson(node.children, options), { type: "bold" });
    case "delete":
      return withMark(phrasingToJson(node.children, options), { type: "strike" });
    case "inlineCode":
      return textJson(node.value, [{ type: "code" }]);
    case "link":
      return withMark(phrasingToJson(node.children, options), {
        type: "link",
        attrs: linkAttrs(node.url, node.title ?? undefined),
      });
    case "linkReference":
      return textJson(`[${plainText(node.children)}][${node.identifier}]`);
    case "image":
      return [
        {
          type: "image",
          attrs: imageAttrs(node.url, node.alt ?? "", node.title ?? undefined),
        },
      ];
    case "imageReference":
      return textJson(`![${node.alt ?? ""}][${node.identifier}]`);
    case "break":
      return [{ type: "hardBreak" }];
    case "footnoteReference":
      return textJson(`[^${node.identifier}]`);
    case "html":
      return htmlToJson(node.value, options, "text");
    default:
      return [];
  }
}

function htmlToJson(
  value: string,
  options: MdastToJsonOptions,
  fallbackKind: "flow" | "text",
): JSONContent[] {
  const rawMdx = options.rawMdxById ? rawMdxFromHtml(value, options.rawMdxById) : null;
  if (rawMdx) {
    const attrs = getRawMdxAttrs(rawMdx);
    const registry = options.componentRegistry ?? defaultComponentRegistry;
    const entry = attrs && fallbackKind === "flow" ? registry.get(attrs.name) : undefined;
    const registered = entry?.mdastToJson(
      { type: "html", value: attrs?.raw ?? value },
      createRegistryContext(options),
    );
    if (registered) {
      return [registered];
    }
    return [rawMdx];
  }

  return fallbackKind === "flow"
    ? [paragraphJson([{ type: "text", value }], options)]
    : textJson(value);
}

function createRegistryContext(options: MdastToJsonOptions): ComponentRegistryContext {
  return {
    markdownToJson(markdown) {
      const body = trimOuterBlankLines(markdown);
      if (!body) {
        return [];
      }

      const extracted = extractRawMdx(body);
      return (
        mdastToJson(parseMarkdownAst(extracted.markdown), {
          ...options,
          rawMdxById: extracted.rawMdxById,
        }).content ?? []
      );
    },
    jsonToMarkdown() {
      return "";
    },
  };
}

function trimOuterBlankLines(value: string): string {
  return value.replace(/^\s*\n/, "").replace(/\n\s*$/, "");
}

function textJson(text: string, marks?: JsonMark[]): JSONContent[] {
  if (!text) {
    return [];
  }
  return [{ type: "text", text, marks }];
}

function withMark(content: JSONContent[], mark: JsonMark): JSONContent[] {
  return content.map((node) =>
    node.type === "text" || node.type === rawMdxNodeName
      ? { ...node, marks: [...(node.marks ?? []), mark] }
      : node,
  );
}

function listAttrs(start: number | undefined): JsonAttrs | undefined {
  return start && start !== 1 ? { start } : undefined;
}

function codeAttrs(language: string | undefined, meta: string | undefined): JsonAttrs | undefined {
  const attrs: JsonAttrs = {};
  if (language) {
    attrs.language = language;
  }
  if (meta) {
    attrs.meta = meta;
  }
  return Object.keys(attrs).length > 0 ? attrs : undefined;
}

function tableAttrs(align: AlignType[] | undefined): JsonAttrs | undefined {
  if (!Array.isArray(align) || align.length === 0) {
    return undefined;
  }
  return { align };
}

function linkAttrs(href: string, title: string | undefined): JsonAttrs {
  return title ? { href, title } : { href };
}

function imageAttrs(src: string, alt: string, title: string | undefined): JsonAttrs {
  return title ? { src, alt, title } : { src, alt };
}

function plainText(children: PhrasingContent[]): string {
  return children
    .map((child) => {
      if ("value" in child && typeof child.value === "string") {
        return child.value;
      }
      if ("children" in child) {
        return plainText(child.children as PhrasingContent[]);
      }
      return "";
    })
    .join("");
}

function definitionSource(identifier: string): string {
  return `[${identifier}]:`;
}

function footnoteDefinitionSource(identifier: string): string {
  return `[^${identifier}]:`;
}
