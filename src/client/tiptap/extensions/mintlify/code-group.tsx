import { Node } from "@tiptap/core";
import {
  NodeViewContent,
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react";
import * as React from "react";

import { CodeBlock } from "../../../../vendor/mintlify-components/components/code-block";
import { MdxEditorButton, MdxPropsPanel, stringAttr } from "./shared";

export const CodeGroupNode = Node.create({
  name: "mintlifyCodeGroup",

  group: "block",

  content: "mintlifyCodeGroupItem+",

  defining: true,

  parseHTML() {
    return [{ tag: "gitcms-mintlify-code-group" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["gitcms-mintlify-code-group", HTMLAttributes, 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeGroupView);
  },
});

export const CodeGroupItemNode = Node.create({
  name: "mintlifyCodeGroupItem",

  atom: true,

  defining: true,

  selectable: true,

  addAttributes() {
    return {
      title: {
        default: "Code",
      },
      language: {
        default: "text",
      },
      code: {
        default: "",
      },
    };
  },

  parseHTML() {
    return [{ tag: "gitcms-mintlify-code-group-item" }];
  },

  renderHTML({ HTMLAttributes }) {
    return ["gitcms-mintlify-code-group-item", HTMLAttributes];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CodeGroupItemView);
  },
});

function CodeGroupView(): React.ReactElement {
  return (
    <NodeViewWrapper className="gitcms-mdx-node gitcms-mdx-code-group">
      <NodeViewContent className="gitcms-mdx-code-group-tabs" />
    </NodeViewWrapper>
  );
}

function CodeGroupItemView({ node, updateAttributes }: NodeViewProps): React.ReactElement {
  const [editing, setEditing] = React.useState(false);
  const title = stringAttr(node.attrs, "title", "Code");
  const language = stringAttr(node.attrs, "language", "text");
  const code = stringAttr(node.attrs, "code");

  return (
    <NodeViewWrapper className="gitcms-mdx-code-group-item">
      <div className="gitcms-mdx-code-group-item-header" contentEditable={false}>
        <span>{title}</span>
        <MdxEditorButton
          label="Edit Code Block"
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
            <span>Language</span>
            <input
              onChange={(event) => updateAttributes({ language: event.currentTarget.value })}
              type="text"
              value={language}
            />
          </label>
        </MdxPropsPanel>
      ) : null}
      <div className="gitcms-mdx-code-preview" contentEditable={false}>
        <CodeBlock filename={title} language={language}>
          {code}
        </CodeBlock>
      </div>
      <textarea
        aria-label={`${title} code`}
        className="gitcms-mdx-code-editor"
        contentEditable={false}
        onChange={(event) => updateAttributes({ code: event.currentTarget.value })}
        rows={Math.max(3, code.split("\n").length)}
        spellCheck={false}
        value={code}
      />
    </NodeViewWrapper>
  );
}
