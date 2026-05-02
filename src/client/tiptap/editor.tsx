import { EditorContent, useEditor } from "@tiptap/react";
import {
  BoldIcon,
  CodeIcon,
  Heading1Icon,
  Heading2Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  QuoteIcon,
  TableIcon,
} from "lucide-react";
import * as React from "react";

import { Button } from "../../components/ui/button";
import { createGitcmsExtensions } from "./extensions";
import { htmlToMarkdown, markdownToHtml } from "./markdown-serializer";

export interface GitcmsEditorProps {
  /** Initial markdown source. Reset by remounting the component with a new key. */
  initialMarkdown: string;
  /** Called when Tiptap content changes. */
  onMarkdownChange: (markdown: string) => void;
  /** Called when the user requests a media image. */
  onOpenMediaPicker: (insertUrl: (url: string, alt?: string) => void) => void;
}

/** Tiptap-backed WYSIWYG markdown editor. */
export function GitcmsEditor({
  initialMarkdown,
  onMarkdownChange,
  onOpenMediaPicker,
}: GitcmsEditorProps): React.ReactElement {
  const editor = useEditor({
    extensions: createGitcmsExtensions(),
    content: markdownToHtml(initialMarkdown),
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      onMarkdownChange(htmlToMarkdown(currentEditor.getHTML()));
    },
  });

  if (!editor) {
    return <div className="rounded-md border border-slate-200 bg-white p-6 text-sm">Loading editor...</div>;
  }

  return (
    <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2">
        <Button
          size="icon"
          variant="ghost"
          aria-label="Heading 1"
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        >
          <Heading1Icon className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Heading 2"
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          <Heading2Icon className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Bold"
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <BoldIcon className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Italic"
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <ItalicIcon className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Bullet list"
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          <ListIcon className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Ordered list"
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrderedIcon className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Blockquote"
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          <QuoteIcon className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Code block"
          onClick={() => editor.chain().focus().toggleCodeBlock().run()}
        >
          <CodeIcon className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Link"
          onClick={() => {
            const href = window.prompt("URL");
            if (href) editor.chain().focus().setLink({ href }).run();
          }}
        >
          <LinkIcon className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Image"
          onClick={() =>
            onOpenMediaPicker((url, alt) => {
              editor.chain().focus().setImage({ src: url, alt: alt ?? "" }).run();
            })
          }
        >
          <ImageIcon className="size-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          aria-label="Table"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <TableIcon className="size-4" />
        </Button>
      </div>
      <EditorContent className="prose max-w-none p-5 text-slate-900" editor={editor} />
    </div>
  );
}
