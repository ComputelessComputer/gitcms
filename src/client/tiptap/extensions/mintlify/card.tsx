import { Node } from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import * as React from "react";

import { Card } from "../../../../vendor/mintlify-components/components/card";
import { MdxEditorButton, MdxPropsPanel, stringAttr } from "./shared";

export const CardNode = Node.create({
  name: "mintlifyCard",

  group: "block",

  content: "block*",

  defining: true,

  addAttributes() {
    return {
      title: {
        default: "Card",
      },
      href: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "gitcms-mintlify-card" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["gitcms-mintlify-card", HTMLAttributes, 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CardView);
  },
});

function CardView({ node, updateAttributes }: NodeViewProps): React.ReactElement {
  const [editing, setEditing] = React.useState(false);
  const title = stringAttr(node.attrs, "title", "Card");
  const href = stringAttr(node.attrs, "href");

  return (
    <NodeViewWrapper className="gitcms-mdx-node gitcms-mdx-card">
      <div className="gitcms-mdx-node-toolbar" contentEditable={false}>
        <MdxEditorButton
          label="Edit Card"
          onClick={() => setEditing((current) => !current)}
          open={editing}
        />
      </div>
      {editing ? (
        <MdxPropsPanel>
          <label>
            <span>Title</span>
            <input
              onChange={(event) => updateAttributes({ title: event.currentTarget.value })}
              type="text"
              value={title}
            />
          </label>
          <label>
            <span>Href</span>
            <input
              onChange={(event) => updateAttributes({ href: event.currentTarget.value })}
              placeholder="Optional URL"
              type="url"
              value={href}
            />
          </label>
        </MdxPropsPanel>
      ) : null}
      <Card href={href || undefined} title={title}>
        <NodeViewContent className="gitcms-mdx-content" />
      </Card>
    </NodeViewWrapper>
  );
}
