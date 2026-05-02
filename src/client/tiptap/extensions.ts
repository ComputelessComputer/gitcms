import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import TableRow from "@tiptap/extension-table-row";
import StarterKit from "@tiptap/starter-kit";

import { RawMdxNode } from "../../markdown/raw-mdx-node";
import {
  AccordionNode,
  CalloutNode,
  CardNode,
  CodeGroupItemNode,
  CodeGroupNode,
  StepNode,
  StepsNode,
  TabNode,
  TabsNode,
} from "./extensions/mintlify";

/** Shared Tiptap extension set for gitcms markdown editing. */
export function createGitcmsExtensions(placeholder = "Write markdown content...") {
  return [
    StarterKit.configure({
      codeBlock: {
        HTMLAttributes: {
          class: "gitcms-code-block",
        },
      },
    }),
    Link.configure({
      autolink: true,
      openOnClick: false,
    }),
    Image.configure({
      allowBase64: false,
      inline: false,
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
    CalloutNode,
    CardNode,
    TabsNode,
    TabNode,
    StepsNode,
    StepNode,
    AccordionNode,
    CodeGroupNode,
    CodeGroupItemNode,
    RawMdxNode,
    Placeholder.configure({ placeholder }),
  ];
}
