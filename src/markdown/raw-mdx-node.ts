import Image from "@tiptap/extension-image";

import {
  rawMdxNodeName,
  readRawMdxMetadata,
  type RawMdxAttrs,
  type RawMdxKind,
} from "./ast/mdx-jsx-utils";

interface RawMdxNodeLike {
  attrs: Record<string, unknown>;
  type: {
    name: string;
  };
}

export const RawMdxNode = Image.extend({
  name: rawMdxNodeName,

  group: "block inline",

  inline: true,

  atom: true,

  selectable: true,

  addAttributes() {
    return {
      raw: {
        default: "",
      },
      kind: {
        default: "flow",
      },
      name: {
        default: "MDX",
      },
      attributesText: {
        default: "",
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: "[data-gitcms-raw-mdx]",
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attrs = readNodeAttrs(node);
    const tag = attrs.kind === "text" ? "span" : "div";
    return [
      tag,
      {
        ...HTMLAttributes,
        "data-gitcms-raw-mdx": attrs.kind,
        "data-mdx-name": attrs.name,
        class: attrs.kind === "text" ? "gitcms-raw-mdx gitcms-raw-mdx-text" : "gitcms-raw-mdx",
      },
      attrs.raw,
    ];
  },

  addNodeView() {
    return (props) => {
      let currentNode = props.node;
      let attrs = readNodeAttrs(currentNode);
      const dom = document.createElement(attrs.kind === "text" ? "span" : "div");
      const label = document.createElement("span");
      const textarea = document.createElement("textarea");

      dom.dataset.gitcmsRawMdx = attrs.kind;
      dom.className =
        attrs.kind === "text" ? "gitcms-raw-mdx gitcms-raw-mdx-text" : "gitcms-raw-mdx";

      label.className = "gitcms-raw-mdx-badge";
      label.contentEditable = "false";

      textarea.className = "gitcms-raw-mdx-editor";
      textarea.spellcheck = false;
      textarea.rows = attrs.kind === "text" ? 1 : Math.max(3, attrs.raw.split("\n").length);
      textarea.value = attrs.raw;
      textarea.setAttribute("aria-label", `Raw MDX ${attrs.name}`);

      textarea.addEventListener("input", () => {
        const nextAttrs = readRawMdxMetadata(textarea.value, attrs.kind);
        attrs = nextAttrs;
        label.textContent = badgeText(attrs);

        if (typeof props.getPos !== "function") {
          return;
        }

        const position = props.getPos();
        if (typeof position !== "number") {
          return;
        }

        props.view.dispatch(
          props.view.state.tr.setNodeMarkup(position, undefined, {
            ...currentNode.attrs,
            ...nextAttrs,
          }),
        );
      });

      dom.append(label, textarea);
      syncDom(dom, label, textarea, attrs);

      return {
        dom,
        update(nextNode) {
          if (nextNode.type.name !== rawMdxNodeName) {
            return false;
          }

          currentNode = nextNode;
          attrs = readNodeAttrs(nextNode);
          syncDom(dom, label, textarea, attrs);
          return true;
        },
        stopEvent(event: Event) {
          return event.target instanceof globalThis.Node && dom.contains(event.target);
        },
        ignoreMutation() {
          return true;
        },
      };
    };
  },

  addCommands() {
    return {};
  },
});

function syncDom(
  dom: HTMLElement,
  label: HTMLElement,
  textarea: HTMLTextAreaElement,
  attrs: RawMdxAttrs,
): void {
  dom.dataset.gitcmsRawMdx = attrs.kind;
  dom.dataset.mdxName = attrs.name;
  label.textContent = badgeText(attrs);
  if (textarea.value !== attrs.raw) {
    textarea.value = attrs.raw;
  }
  textarea.rows = attrs.kind === "text" ? 1 : Math.max(3, attrs.raw.split("\n").length);
  textarea.setAttribute("aria-label", `Raw MDX ${attrs.name}`);
}

function readNodeAttrs(node: RawMdxNodeLike): RawMdxAttrs {
  const raw = stringAttr(node.attrs, "raw") ?? "";
  const kind = rawMdxKindAttr(node.attrs);
  const metadata = readRawMdxMetadata(raw, kind);
  return {
    raw,
    kind,
    name: stringAttr(node.attrs, "name") ?? metadata.name,
    attributesText: stringAttr(node.attrs, "attributesText") ?? metadata.attributesText,
  };
}

function badgeText(attrs: RawMdxAttrs): string {
  return attrs.name ? `MDX ${attrs.name}` : "MDX";
}

function rawMdxKindAttr(attrs: RawMdxNodeLike["attrs"]): RawMdxKind {
  const kind = attrs.kind;
  return kind === "text" ? "text" : "flow";
}

function stringAttr(attrs: RawMdxNodeLike["attrs"], key: string): string | undefined {
  const value = attrs[key];
  return typeof value === "string" ? value : undefined;
}
