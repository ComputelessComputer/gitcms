import { Node } from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import * as React from "react";

import { Accordion } from "../../../../vendor/mintlify-components/components/accordion";
import { booleanAttr, MdxEditorButton, MdxPropsPanel, stringAttr } from "./shared";

export const AccordionNode = Node.create({
  name: "mintlifyAccordion",

  group: "block",

  content: "block*",

  defining: true,

  addAttributes() {
    return {
      title: {
        default: "Accordion",
      },
      defaultOpen: {
        default: false,
      },
    };
  },

  parseHTML() {
    return [{ tag: "gitcms-mintlify-accordion" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["gitcms-mintlify-accordion", HTMLAttributes, 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(AccordionView);
  },
});

function AccordionView({ node, updateAttributes }: NodeViewProps): React.ReactElement {
  const [editing, setEditing] = React.useState(false);
  const title = stringAttr(node.attrs, "title", "Accordion");
  const defaultOpen = booleanAttr(node.attrs, "defaultOpen");

  return (
    <NodeViewWrapper className="gitcms-mdx-node gitcms-mdx-accordion">
      <div className="gitcms-mdx-node-toolbar" contentEditable={false}>
        <MdxEditorButton
          label="Edit Accordion"
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
          <label className="gitcms-mdx-checkbox-label">
            <input
              checked={defaultOpen}
              onChange={(event) => updateAttributes({ defaultOpen: event.currentTarget.checked })}
              type="checkbox"
            />
            <span>Default open</span>
          </label>
        </MdxPropsPanel>
      ) : null}
      <Accordion defaultOpen={defaultOpen} title={title}>
        <NodeViewContent className="gitcms-mdx-content" />
      </Accordion>
    </NodeViewWrapper>
  );
}
