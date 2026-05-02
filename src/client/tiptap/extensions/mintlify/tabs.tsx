import { Node } from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import * as React from "react";

import { MdxEditorButton, MdxPropsPanel, stringAttr } from "./shared";

export const TabsNode = Node.create({
  name: "mintlifyTabs",

  group: "block",

  content: "mintlifyTab+",

  defining: true,

  addAttributes() {
    return {
      defaultTab: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "gitcms-mintlify-tabs" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["gitcms-mintlify-tabs", HTMLAttributes, 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TabsView);
  },
});

export const TabNode = Node.create({
  name: "mintlifyTab",

  content: "block*",

  defining: true,

  addAttributes() {
    return {
      title: {
        default: "Tab",
      },
    };
  },

  parseHTML() {
    return [{ tag: "gitcms-mintlify-tab" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["gitcms-mintlify-tab", HTMLAttributes, 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(TabView);
  },
});

function TabsView(): React.ReactElement {
  return (
    <NodeViewWrapper className="gitcms-mdx-node gitcms-mdx-tabs">
      <NodeViewContent className="gitcms-mdx-tabs-list" />
    </NodeViewWrapper>
  );
}

function TabView({ node, updateAttributes }: NodeViewProps): React.ReactElement {
  const [editing, setEditing] = React.useState(false);
  const title = stringAttr(node.attrs, "title", "Tab");

  return (
    <NodeViewWrapper className="gitcms-mdx-tab">
      <div className="gitcms-mdx-tab-header" contentEditable={false}>
        <span>{title}</span>
        <MdxEditorButton
          label="Edit Tab"
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
        </MdxPropsPanel>
      ) : null}
      <NodeViewContent className="gitcms-mdx-tab-content" />
    </NodeViewWrapper>
  );
}
