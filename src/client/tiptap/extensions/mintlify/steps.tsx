import { Node } from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import * as React from "react";

import { MdxEditorButton, MdxPropsPanel, stringAttr } from "./shared";

export const StepsNode = Node.create({
  name: "mintlifySteps",

  group: "block",

  content: "mintlifyStep+",

  defining: true,

  parseHTML() {
    return [{ tag: "gitcms-mintlify-steps" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["gitcms-mintlify-steps", HTMLAttributes, 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(StepsView);
  },
});

export const StepNode = Node.create({
  name: "mintlifyStep",

  content: "block*",

  defining: true,

  addAttributes() {
    return {
      title: {
        default: "Step",
      },
    };
  },

  parseHTML() {
    return [{ tag: "gitcms-mintlify-step" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["gitcms-mintlify-step", HTMLAttributes, 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(StepView);
  },
});

function StepsView(): React.ReactElement {
  return (
    <NodeViewWrapper className="gitcms-mdx-node gitcms-mdx-steps">
      <NodeViewContent className="gitcms-mdx-steps-list" />
    </NodeViewWrapper>
  );
}

function StepView({ node, updateAttributes, getPos, editor }: NodeViewProps): React.ReactElement {
  const [editing, setEditing] = React.useState(false);
  const title = stringAttr(node.attrs, "title", "Step");
  const position = typeof getPos === "function" ? getPos() : null;
  const index = typeof position === "number" ? stepIndexAt(editor.state.doc, position) : 1;

  return (
    <NodeViewWrapper className="gitcms-mdx-step">
      <div className="gitcms-mdx-step-marker" contentEditable={false}>
        {index}
      </div>
      <div className="gitcms-mdx-step-body">
        <div className="gitcms-mdx-step-title" contentEditable={false}>
          <span>{title}</span>
          <MdxEditorButton
            label="Edit Step"
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
        <NodeViewContent className="gitcms-mdx-step-content" />
      </div>
    </NodeViewWrapper>
  );
}

function stepIndexAt(doc: NodeViewProps["editor"]["state"]["doc"], position: number): number {
  let index = 1;
  doc.descendants((child, childPosition) => {
    if (childPosition >= position) {
      return false;
    }
    if (child.type.name === "mintlifyStep") {
      index += 1;
    }
    return true;
  });
  return index;
}
