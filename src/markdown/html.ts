import type {
  BlockContent,
  DefinitionContent,
  ListItem,
  PhrasingContent,
  RootContent,
  TableCell,
  TableRow,
} from "mdast";

import { parseMarkdownAst, splitFrontmatter } from "./remark-adapter";

/** Renders trusted operator-authored markdown into HTML for read-only panels. */
export function markdownToHtml(markdown: string): string {
  const { body } = splitFrontmatter(markdown);
  const tree = parseMarkdownAst(body);
  return tree.children.map((child) => renderBlock(child)).join("");
}

function renderBlock(node: RootContent): string {
  switch (node.type) {
    case "heading":
      return `<h${node.depth}>${renderInline(node.children)}</h${node.depth}>`;
    case "paragraph":
      return `<p>${renderInline(node.children)}</p>`;
    case "blockquote":
      return `<blockquote>${node.children.map((child) => renderBlockContent(child)).join("")}</blockquote>`;
    case "list":
      return renderList(node.ordered ? "ol" : "ul", node.start ?? undefined, node.children);
    case "listItem":
      return renderListItem(node);
    case "code":
      return `<pre><code${node.lang ? ` class="language-${escapeAttr(node.lang)}"` : ""}>${escapeHtml(node.value)}</code></pre>`;
    case "thematicBreak":
      return "<hr />";
    case "table":
      return renderTable(node.children);
    case "html":
      return node.value;
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
      return `<p>${renderInline([node])}</p>`;
    case "definition":
      return "";
    case "footnoteDefinition":
      return "";
    case "tableCell":
      return `<p>${renderInline(node.children)}</p>`;
    case "tableRow":
      return `<table><tbody>${renderTableRow(node, "td")}</tbody></table>`;
    case "yaml":
      return "";
    default:
      return "";
  }
}

function renderBlockContent(node: BlockContent | DefinitionContent): string {
  return renderBlock(node);
}

function renderList(tag: "ol" | "ul", start: number | undefined, children: ListItem[]): string {
  const startAttr = tag === "ol" && start && start !== 1 ? ` start="${start}"` : "";
  return `<${tag}${startAttr}>${children.map((child) => renderListItem(child)).join("")}</${tag}>`;
}

function renderListItem(node: ListItem): string {
  const task =
    typeof node.checked === "boolean"
      ? `<input type="checkbox" disabled${node.checked ? " checked" : ""} /> `
      : "";
  return `<li>${task}${node.children.map((child) => renderBlockContent(child)).join("")}</li>`;
}

function renderTable(rows: TableRow[]): string {
  const [head, ...body] = rows;
  const headHtml = head ? `<thead>${renderTableRow(head, "th")}</thead>` : "";
  const bodyHtml =
    body.length > 0
      ? `<tbody>${body.map((row) => renderTableRow(row, "td")).join("")}</tbody>`
      : "";
  return `<table>${headHtml}${bodyHtml}</table>`;
}

function renderTableRow(row: TableRow, cellTag: "td" | "th"): string {
  return `<tr>${row.children.map((cell) => renderTableCell(cell, cellTag)).join("")}</tr>`;
}

function renderTableCell(cell: TableCell, tag: "td" | "th"): string {
  return `<${tag}>${renderInline(cell.children)}</${tag}>`;
}

function renderInline(children: PhrasingContent[]): string {
  return children.map((child) => renderInlineNode(child)).join("");
}

function renderInlineNode(node: PhrasingContent): string {
  switch (node.type) {
    case "text":
      return escapeHtml(node.value);
    case "emphasis":
      return `<em>${renderInline(node.children)}</em>`;
    case "strong":
      return `<strong>${renderInline(node.children)}</strong>`;
    case "delete":
      return `<del>${renderInline(node.children)}</del>`;
    case "inlineCode":
      return `<code>${escapeHtml(node.value)}</code>`;
    case "link":
      return `<a href="${escapeAttr(node.url)}"${node.title ? ` title="${escapeAttr(node.title)}"` : ""}>${renderInline(node.children)}</a>`;
    case "linkReference":
      return escapeHtml(`[${plainText(node.children)}][${node.identifier}]`);
    case "image":
      return `<img src="${escapeAttr(node.url)}" alt="${escapeAttr(node.alt ?? "")}"${node.title ? ` title="${escapeAttr(node.title)}"` : ""} />`;
    case "imageReference":
      return escapeHtml(`![${node.alt ?? ""}][${node.identifier}]`);
    case "break":
      return "<br />";
    case "footnoteReference":
      return escapeHtml(`[^${node.identifier}]`);
    case "html":
      return node.value;
    default:
      return "";
  }
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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
