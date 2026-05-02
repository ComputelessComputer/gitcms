import { useQuery } from "@tanstack/react-query";
import { BookOpenTextIcon, ChevronDownIcon, ChevronRightIcon, CopyIcon } from "lucide-react";
import * as React from "react";

import { authorContextQueryOptions } from "../queries/context";
import { markdownToHtml } from "../client/tiptap/markdown-serializer";
import { Button } from "./ui/button";

export interface AuthorContextPanelProps {
  /** Optional collection id — when set, includes the collection-level voice override. */
  collectionId?: string;
  /** Branch to read the brief from. Defaults to the configured content branch. */
  branch?: string;
  /** Whether the panel starts expanded. Defaults to false (don't crowd the editor). */
  defaultOpen?: boolean;
}

/** Renders the author writing brief alongside the editor.
 *
 *  Read-only by design — the brief is operator-edited markdown in the content
 *  repo (`content/.gitcms/...`). Authors and AI agents consume it; no inline
 *  editing here in v0.0.1. The panel exists so human authors can see the same
 *  rules an agent would see via `GET /api/context`. */
export function AuthorContextPanel({
  collectionId,
  branch,
  defaultOpen = false,
}: AuthorContextPanelProps): React.ReactElement {
  const [open, setOpen] = React.useState(defaultOpen);
  const query = useQuery(authorContextQueryOptions(collectionId, branch));

  const merged = query.data?.merged ?? "";
  const hasBrief = merged.trim().length > 0;
  const html = React.useMemo(() => (hasBrief ? markdownToHtml(merged) : ""), [merged, hasBrief]);

  return (
    <section className="border-b border-slate-200 bg-slate-50">
      <div className="flex items-center gap-2 px-4 py-2">
        <button
          type="button"
          className="flex flex-1 items-center gap-2 text-left text-sm font-medium text-slate-700 hover:text-slate-900"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          {open ? (
            <ChevronDownIcon className="size-4 text-slate-500" />
          ) : (
            <ChevronRightIcon className="size-4 text-slate-500" />
          )}
          <BookOpenTextIcon className="size-4 text-slate-500" />
          <span>Writing brief</span>
          <PanelStatusLabel
            loading={query.isPending}
            error={query.isError}
            hasBrief={hasBrief}
            collectionId={collectionId}
          />
        </button>
        {hasBrief && open && <CopyBriefButton text={merged} />}
      </div>

      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-3">
          {query.isPending ? (
            <p className="text-sm text-slate-500">Loading brief…</p>
          ) : query.isError ? (
            <p className="text-sm text-red-600">
              Failed to load the writing brief: {(query.error as Error).message}
            </p>
          ) : hasBrief ? (
            <div
              className="prose prose-sm max-w-none text-slate-700"
              // The brief is operator-authored markdown from the content repo.
              // marked is configured by the existing tiptap pipeline; we trust
              // the same source here.
              dangerouslySetInnerHTML={{ __html: html }}
            />
          ) : (
            <EmptyBriefHint />
          )}
        </div>
      )}
    </section>
  );
}

function PanelStatusLabel({
  loading,
  error,
  hasBrief,
  collectionId,
}: {
  loading: boolean;
  error: boolean;
  hasBrief: boolean;
  collectionId?: string;
}): React.ReactElement {
  if (loading) {
    return <span className="ml-auto text-xs text-slate-400">loading…</span>;
  }
  if (error) {
    return <span className="ml-auto text-xs text-red-500">error</span>;
  }
  if (!hasBrief) {
    return <span className="ml-auto text-xs text-slate-400">not configured</span>;
  }
  return (
    <span className="ml-auto text-xs text-slate-500">
      {collectionId ? `${collectionId} voice` : "repo brief"}
    </span>
  );
}

function CopyBriefButton({ text }: { text: string }): React.ReactElement {
  const [copied, setCopied] = React.useState(false);

  return (
    <Button
      variant="ghost"
      size="sm"
      type="button"
      className="h-7 px-2 text-xs"
      onClick={() => {
        void navigator.clipboard.writeText(text).then(() => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        });
      }}
    >
      <CopyIcon className="size-3.5" />
      {copied ? "Copied" : "Copy"}
    </Button>
  );
}

function EmptyBriefHint(): React.ReactElement {
  return (
    <div className="text-sm text-slate-600">
      <p>
        No writing brief is configured. Add{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">content/.gitcms/context.md</code>{" "}
        and{" "}
        <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">content/.gitcms/voice.md</code>{" "}
        to your content repo to give human authors and AI agents shared brand and voice rules.
      </p>
      <p className="mt-2 text-xs text-slate-500">
        Run <code className="rounded bg-slate-100 px-1 py-0.5">pnpm gitcms init-context</code> to
        scaffold starter files, or see{" "}
        <a
          className="underline hover:text-slate-700"
          href="https://github.com/ComputelessComputer/gitcms/blob/main/docs/AUTHOR-CONTEXT.md"
          target="_blank"
          rel="noreferrer"
        >
          docs/AUTHOR-CONTEXT.md
        </a>
        .
      </p>
    </div>
  );
}
