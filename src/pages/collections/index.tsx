import { useQuery } from "@tanstack/react-query";
import { SaveIcon, SendIcon, Trash2Icon } from "lucide-react";
import * as React from "react";

import type { CollectionDescriptor } from "../../config";
import { AuthorContextPanel } from "../../components/author-context-panel";
import { FrontmatterPanel } from "../../components/frontmatter-panel";
import { FileTree } from "../../components/file-tree";
import { MarkdownEditor } from "../../components/markdown-editor";
import { MediaPickerDialog } from "../../components/media-picker-dialog";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import {
  contentFileQueryOptions,
  contentListQueryOptions,
  useContentDeleteMutation,
  useContentPublishMutation,
  useContentRenameMutation,
  useContentSaveMutation,
} from "../../queries/content";
import { runtimeConfigQueryOptions } from "../../queries/config";
import type { ContentFile } from "../../github/types";
import type { JsonRecord } from "../../lib/markdown";
import { slugify } from "../../lib/slug";

interface DraftFile {
  /** Unsaved slug. */
  slug: string;
  /** Unsaved frontmatter. */
  frontmatter: JsonRecord;
  /** Unsaved markdown body. */
  body: string;
}

/** Top-level collections editor page. */
export function CollectionsPage(): React.ReactElement {
  const configQuery = useQuery(runtimeConfigQueryOptions());
  const config = configQuery.data;
  const [selectedCollectionId, setSelectedCollectionId] = React.useState("");
  const [selectedPath, setSelectedPath] = React.useState("");
  const [draft, setDraft] = React.useState<DraftFile | null>(null);
  const collectionId = selectedCollectionId || config?.collections[0]?.id || "";
  const collection = config?.collections.find((entry) => entry.id === collectionId);
  const filesQuery = useQuery(contentListQueryOptions(collectionId));
  const files = filesQuery.data ?? [];
  const firstFile = files.find((file) => file.type === "file");
  const activePath = draft ? "" : selectedPath || firstFile?.path || "";
  const fileQuery = useQuery(contentFileQueryOptions(collectionId, activePath));
  const deleteMutation = useContentDeleteMutation(collectionId);

  if (configQuery.isLoading || !config || !collection) {
    return <div className="p-6 text-sm text-slate-600">Loading collections...</div>;
  }

  const activeFile = draft ? null : fileQuery.data;

  return (
    <div className="grid h-[calc(100vh-57px)] grid-cols-[280px_minmax(0,1fr)] bg-slate-50">
      <FileTree
        collections={config.collections}
        collectionId={collection.id}
        files={files}
        selectedPath={activePath}
        onCollectionChange={(nextCollectionId) => {
          setSelectedCollectionId(nextCollectionId);
          setSelectedPath("");
          setDraft(null);
        }}
        onFileSelect={(path) => {
          setSelectedPath(path);
          setDraft(null);
        }}
        onNewFile={() => {
          const title = window.prompt("Title")?.trim();
          if (!title) return;
          const nextDraft = {
            slug: slugify(title) || "untitled",
            frontmatter: defaultFrontmatter(collection, title),
            body: "",
          };
          setDraft(nextDraft);
          setSelectedPath("");
        }}
      />
      {draft ? (
        <ContentEditorPane
          key={`draft:${collection.id}:${draft.slug}`}
          collection={collection}
          initialSlug={draft.slug}
          initialFrontmatter={draft.frontmatter}
          initialBody={draft.body}
          onDelete={undefined}
          onSaved={(path) => {
            setDraft(null);
            setSelectedPath(path);
          }}
        />
      ) : activeFile ? (
        <ContentEditorPane
          key={`${activeFile.path}:${activeFile.sha}`}
          collection={collection}
          file={activeFile}
          initialSlug={activeFile.slug}
          initialFrontmatter={activeFile.frontmatter}
          initialBody={activeFile.body}
          onDelete={async () => {
            if (!window.confirm(`Delete ${activeFile.path}?`)) return;
            await deleteMutation.mutateAsync({
              path: activeFile.path,
              commitMessage: `Delete ${activeFile.path}`,
            });
            setSelectedPath("");
          }}
          onSaved={setSelectedPath}
        />
      ) : (
        <main className="flex items-center justify-center text-sm text-slate-500">
          Select or create a file.
        </main>
      )}
    </div>
  );
}

function ContentEditorPane({
  collection,
  file,
  initialSlug,
  initialFrontmatter,
  initialBody,
  onDelete,
  onSaved,
}: {
  collection: CollectionDescriptor;
  file?: ContentFile;
  initialSlug: string;
  initialFrontmatter: JsonRecord;
  initialBody: string;
  onDelete?: () => Promise<void>;
  onSaved: (path: string) => void;
}): React.ReactElement {
  const [slug, setSlug] = React.useState(initialSlug);
  const [frontmatter, setFrontmatter] = React.useState<JsonRecord>(initialFrontmatter);
  const [body, setBody] = React.useState(initialBody);
  const [directCommit, setDirectCommit] = React.useState(false);
  const [mediaInsert, setMediaInsert] = React.useState<
    ((url: string, alt?: string) => void) | null
  >(null);
  const saveMutation = useContentSaveMutation();
  const renameMutation = useContentRenameMutation();
  const publishMutation = useContentPublishMutation();

  return (
    <main className="grid min-w-0 grid-cols-[minmax(0,1fr)_320px]">
      <section className="flex min-w-0 flex-col overflow-auto">
        <AuthorContextPanel collectionId={collection.id} />
        <div className="flex flex-1 flex-col p-4">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <Input
              className="max-w-sm"
              value={slug}
              onChange={(event) => setSlug(event.currentTarget.value)}
            />
            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={directCommit}
                onChange={(event) => setDirectCommit(event.currentTarget.checked)}
                className="size-4 rounded border-slate-300"
              />
              Direct commit
            </label>
            <Button
              variant="primary"
              disabled={saveMutation.isPending || renameMutation.isPending}
              onClick={async () => {
                if (file && slug !== file.slug) {
                  await renameMutation.mutateAsync({
                    collectionId: collection.id,
                    fromPath: file.path,
                    toSlug: slug,
                    commitMessage: `Rename ${file.slug} to ${slug}`,
                  });
                }
                const result = await saveMutation.mutateAsync({
                  collectionId: collection.id,
                  slug,
                  frontmatter,
                  body,
                  directCommit,
                  commitMessage: `${file ? "Update" : "Create"} ${slug}`,
                });
                onSaved(result.path);
              }}
            >
              <SaveIcon className="size-4" />
              Save
            </Button>
            <Button
              disabled={publishMutation.isPending}
              onClick={async () => {
                const result = await publishMutation.mutateAsync({
                  slug,
                  title: `Publish ${slug}`,
                });
                window.open(result.url, "_blank", "noopener,noreferrer");
              }}
            >
              <SendIcon className="size-4" />
              Publish
            </Button>
            {onDelete && (
              <Button variant="danger" onClick={() => void onDelete()}>
                <Trash2Icon className="size-4" />
                Delete
              </Button>
            )}
          </div>
          <MarkdownEditor
            initialMarkdown={initialBody}
            onMarkdownChange={setBody}
            onOpenMediaPicker={(insert) => setMediaInsert(() => insert)}
          />
        </div>
      </section>
      <FrontmatterPanel collection={collection} value={frontmatter} onChange={setFrontmatter} />
      <MediaPickerDialog
        open={Boolean(mediaInsert)}
        onOpenChange={(open) => {
          if (!open) setMediaInsert(null);
        }}
        onSelect={(url, alt) => {
          mediaInsert?.(url, alt);
          setMediaInsert(null);
        }}
      />
    </main>
  );
}

function defaultFrontmatter(collection: CollectionDescriptor, title: string): JsonRecord {
  const result: JsonRecord = {};
  for (const [key, field] of Object.entries(collection.schema)) {
    if (field.default !== undefined) {
      result[key] = field.default;
    } else if (key === "title") {
      result[key] = title;
    } else if (field.type === "boolean") {
      result[key] = false;
    } else if (field.type === "string-array") {
      result[key] = [];
    } else if (field.type === "number") {
      result[key] = 0;
    } else {
      result[key] = "";
    }
  }
  return result;
}
