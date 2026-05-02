import { Node } from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import * as React from "react";

import {
  Callout,
  type CalloutVariant,
} from "../../../../vendor/mintlify-components/components/callout";
import { MdxEditorButton, MdxPropsPanel, stringAttr } from "./shared";

const calloutTypes = ["info", "warning", "note", "tip", "check", "danger"] as const;

export const CalloutNode = Node.create({
  name: "mintlifyCallout",

  group: "block",

  content: "block*",

  defining: true,

  addAttributes() {
    return {
      type: {
        default: "info",
      },
      title: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [{ tag: "gitcms-mintlify-callout" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["gitcms-mintlify-callout", HTMLAttributes, 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView);
  },
});

function CalloutView({ node, updateAttributes }: NodeViewProps): React.ReactElement {
  const [editing, setEditing] = React.useState(false);
  const type = readCalloutType(node.attrs);
  const title = stringAttr(node.attrs, "title");

  return (
    <NodeViewWrapper className="gitcms-mdx-node gitcms-mdx-callout">
      <div className="gitcms-mdx-node-toolbar" contentEditable={false}>
        <MdxEditorButton
          label="Edit Callout"
          onClick={() => setEditing((current) => !current)}
          open={editing}
        />
      </div>
      {editing ? (
        <MdxPropsPanel>
          <label>
            <span>Type</span>
            <select
              onChange={(event) => updateAttributes({ type: event.currentTarget.value })}
              value={type}
            >
              {calloutTypes.map((entry) => (
                <option key={entry} value={entry}>
                  {entry}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Title</span>
            <input
              onChange={(event) => updateAttributes({ title: event.currentTarget.value })}
              placeholder="Optional title"
              type="text"
              value={title}
            />
          </label>
        </MdxPropsPanel>
      ) : null}
      <Callout title={title || undefined} variant={type}>
        <NodeViewContent className="gitcms-mdx-content" />
      </Callout>
    </NodeViewWrapper>
  );
}

function readCalloutType(attrs: Record<string, unknown>): CalloutVariant {
  const value = stringAttr(attrs, "type", "info");
  return calloutTypes.find((type) => type === value) ?? "info";
}
