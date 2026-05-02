import type { JSONContent } from "@tiptap/react";
import type {
  AlignType,
  BlockContent,
  Code,
  Heading,
  Image,
  Link,
  List,
  ListItem,
  PhrasingContent,
  Root,
  RootContent,
  Table,
  TableCell,
  TableRow,
} from "mdast";

import { getRawMdxAttrs } from "./mdx-jsx-utils";

type JsonAttrs = NonNullable<JSONContent["attrs"]>;
type JsonMark = NonNullable<JSONContent["marks"]>[number];

/** Converts Tiptap JSONContent into a remark/mdast tree. */
export function jsonToMdast(json: JSONContent): Root {
  return {
    type: "root",
    children: jsonChildren(json).flatMap((child) => jsonBlockToMdast(child)),
  };
}

function jsonBlockToMdast(node: JSONContent): RootContent[] {
  const rawMdx = getRawMdxAttrs(node);
  if (rawMdx) {
    return rawMdx.kind === "flow"
      ? [{ type: "html", value: rawMdx.raw }]
      : [{ type: "paragraph", children: [{ type: "html", value: rawMdx.raw }] }];
  }

  switch (node.type) {
    case "doc":
      return jsonChildren(node).flatMap((child) => jsonBlockToMdast(child));
    case "paragraph":
      return [{ type: "paragraph", children: jsonInlineToMdast(jsonChildren(node)) }];
    case "heading":
      return [
        {
          type: "heading",
          depth: headingDepth(node.attrs),
          children: jsonInlineToMdast(jsonChildren(node)),
        },
      ];
    case "blockquote":
      return [
        {
          type: "blockquote",
          children: jsonChildren(node).flatMap((child) =>
            jsonBlockToMdast(child),
          ) as BlockContent[],
        },
      ];
    case "bulletList":
    case "orderedList":
      return [listToMdast(node)];
    case "listItem":
      return [listItemToMdast(node)];
    case "codeBlock":
      return [codeBlockToMdast(node)];
    case "horizontalRule":
      return [{ type: "thematicBreak" }];
    case "table":
      return [tableToMdast(node)];
    case "image":
      return [{ type: "paragraph", children: [imageToMdast(node.attrs)] }];
    case "hardBreak":
      return [{ type: "paragraph", children: [{ type: "break" }] }];
    case "text":
      return [{ type: "paragraph", children: jsonInlineToMdast([node]) }];
    default:
      return fallbackParagraph(node);
  }
}

function listToMdast(node: JSONContent): List {
  const ordered = node.type === "orderedList";
  const start = numberAttr(node.attrs, "start");
  return {
    type: "list",
    ordered,
    start: ordered && start && start !== 1 ? start : undefined,
    spread: false,
    children: jsonChildren(node).map((child) => listItemToMdast(child)),
  };
}

function listItemToMdast(node: JSONContent): ListItem {
  const checked = booleanAttr(node.attrs, "checked");
  const spread = booleanAttr(node.attrs, "spread");
  return {
    type: "listItem",
    checked,
    spread: spread ?? false,
    children: jsonChildren(node).flatMap((child) => jsonBlockToMdast(child)) as BlockContent[],
  };
}

function codeBlockToMdast(node: JSONContent): Code {
  return {
    type: "code",
    lang: stringAttr(node.attrs, "language"),
    meta: stringAttr(node.attrs, "meta"),
    value: extractText(node),
  };
}

function tableToMdast(node: JSONContent): Table {
  const rows = jsonChildren(node).map((row) => tableRowToMdast(row));
  return {
    type: "table",
    align: alignAttr(node.attrs),
    children: rows,
  };
}

function tableRowToMdast(node: JSONContent): TableRow {
  return {
    type: "tableRow",
    children: jsonChildren(node).map((cell) => tableCellToMdast(cell)),
  };
}

function tableCellToMdast(node: JSONContent): TableCell {
  return {
    type: "tableCell",
    children: jsonChildren(node).flatMap((child) => {
      if (child.type === "paragraph") {
        return jsonInlineToMdast(jsonChildren(child));
      }
      return jsonInlineToMdast([child]);
    }),
  };
}

function jsonInlineToMdast(nodes: JSONContent[]): PhrasingContent[] {
  return renderMarkedInline(nodes, 0);
}

const markOrder = ["link", "bold", "italic", "strike"] as const;
type GroupableMark = (typeof markOrder)[number];

function renderMarkedInline(nodes: JSONContent[], markIndex: number): PhrasingContent[] {
  const markType = markOrder[markIndex];
  if (!markType) {
    return nodes.flatMap((node) => jsonInlineNodeToMdast(node));
  }

  const result: PhrasingContent[] = [];
  let index = 0;
  while (index < nodes.length) {
    const current = nodes[index];
    if (!current) {
      index += 1;
      continue;
    }

    const mark = findMark(current.marks ?? [], markType);
    if (!mark) {
      const run: JSONContent[] = [];
      while (index < nodes.length) {
        const candidate = nodes[index];
        if (!candidate || findMark(candidate.marks ?? [], markType)) {
          break;
        }
        run.push(candidate);
        index += 1;
      }
      result.push(...renderMarkedInline(run, markIndex + 1));
      continue;
    }

    const run: JSONContent[] = [];
    while (index < nodes.length) {
      const candidate = nodes[index];
      const candidateMark = candidate ? findMark(candidate.marks ?? [], markType) : undefined;
      if (!candidate || !candidateMark || !sameMark(mark, candidateMark)) {
        break;
      }
      run.push(removeMark(candidate, markType));
      index += 1;
    }
    result.push(wrapMarkedInline(mark, renderMarkedInline(run, markIndex + 1)));
  }

  return result;
}

function jsonInlineNodeToMdast(node: JSONContent): PhrasingContent[] {
  const rawMdx = getRawMdxAttrs(node);
  if (rawMdx) {
    return [{ type: "html", value: rawMdx.raw }];
  }

  switch (node.type) {
    case "text":
      return textToMdast(node);
    case "hardBreak":
      return [{ type: "break" }];
    case "image":
      return [imageToMdast(node.attrs)];
    default:
      return jsonInlineToMdast(jsonChildren(node));
  }
}

function textToMdast(node: JSONContent): PhrasingContent[] {
  const text = node.text ?? "";
  if (!text) {
    return [];
  }

  return findMark(node.marks ?? [], "code")
    ? [{ type: "inlineCode", value: text }]
    : [{ type: "text", value: text }];
}

function wrapMarkedInline(mark: JsonMark, childList: PhrasingContent[]): PhrasingContent {
  switch (mark.type) {
    case "link":
      return linkToMdast(mark.attrs, childList);
    case "bold":
      return { type: "strong", children: childList };
    case "italic":
      return { type: "emphasis", children: childList };
    case "strike":
      return { type: "delete", children: childList };
    default:
      return { type: "text", value: plainText(childList) };
  }
}

function removeMark(node: JSONContent, type: GroupableMark): JSONContent {
  return {
    ...node,
    marks: (node.marks ?? []).filter((mark) => mark.type !== type),
  };
}

function sameMark(left: JsonMark, right: JsonMark): boolean {
  if (left.type !== right.type) {
    return false;
  }
  if (left.type !== "link") {
    return true;
  }
  return (
    stringAttr(left.attrs, "href") === stringAttr(right.attrs, "href") &&
    stringAttr(left.attrs, "title") === stringAttr(right.attrs, "title")
  );
}

function linkToMdast(attrs: JsonAttrs | undefined, children: PhrasingContent[]): Link {
  return {
    type: "link",
    url: stringAttr(attrs, "href") ?? "",
    title: stringAttr(attrs, "title"),
    children,
  };
}

function imageToMdast(attrs: JsonAttrs | undefined): Image {
  return {
    type: "image",
    url: stringAttr(attrs, "src") ?? "",
    alt: stringAttr(attrs, "alt") ?? "",
    title: stringAttr(attrs, "title"),
  };
}

function headingDepth(attrs: JsonAttrs | undefined): Heading["depth"] {
  const level = numberAttr(attrs, "level");
  if (level === 1 || level === 2 || level === 3 || level === 4 || level === 5 || level === 6) {
    return level;
  }
  return 1;
}

function alignAttr(attrs: JsonAttrs | undefined): AlignType[] | undefined {
  const value = attrs?.align;
  if (!Array.isArray(value)) {
    return undefined;
  }
  return value.map((entry) =>
    entry === "left" || entry === "right" || entry === "center" ? entry : null,
  );
}

function jsonChildren(node: JSONContent): JSONContent[] {
  return node.content ?? [];
}

function findMark(marks: JsonMark[], type: string): JsonMark | undefined {
  return marks.find((mark) => mark.type === type);
}

function stringAttr(attrs: JsonAttrs | undefined, key: string): string | undefined {
  const value = attrs?.[key];
  return typeof value === "string" ? value : undefined;
}

function numberAttr(attrs: JsonAttrs | undefined, key: string): number | undefined {
  const value = attrs?.[key];
  return typeof value === "number" ? value : undefined;
}

function booleanAttr(attrs: JsonAttrs | undefined, key: string): boolean | undefined {
  const value = attrs?.[key];
  return typeof value === "boolean" ? value : undefined;
}

function extractText(node: JSONContent): string {
  if (node.type === "text") {
    return node.text ?? "";
  }
  return jsonChildren(node)
    .map((child) => extractText(child))
    .join("");
}

function fallbackParagraph(node: JSONContent): RootContent[] {
  const text = extractText(node);
  return text ? [{ type: "paragraph", children: [{ type: "text", value: text }] }] : [];
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
