import { useQuery } from "@tanstack/react-query";
import { FolderPlusIcon, UploadIcon } from "lucide-react";
import * as React from "react";

import { movePathIntoFolder } from "../../client/media/library";
import { MediaGrid } from "../../components/media-grid";
import { Button } from "../../components/ui/button";
import { mediaFolderQueryOptions, useMediaMutations } from "../../queries/media";

/** Top-level media library page. */
export function MediaPage(): React.ReactElement {
  const [folder, setFolder] = React.useState("");
  const mediaQuery = useQuery(mediaFolderQueryOptions(folder));
  const treeQuery = useQuery(mediaFolderQueryOptions("", true));
  const mutations = useMediaMutations(folder);
  const folders = buildFolderTree(treeQuery.data ?? []);

  return (
    <div className="grid h-[calc(100vh-57px)] grid-cols-[260px_minmax(0,1fr)] bg-slate-50">
      <aside className="border-r border-slate-200 bg-white p-3">
        <div className="mb-3 flex gap-2">
          <Button
            size="sm"
            variant="primary"
            onClick={() => {
              const name = window.prompt("Folder name")?.trim();
              if (!name) return;
              const path = folder ? `${folder}/${name}` : name;
              mutations.createFolder.mutate(path);
            }}
          >
            <FolderPlusIcon className="size-4" />
            New
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setFolder("")}
          className="mb-1 block w-full rounded-md px-2 py-2 text-left text-sm hover:bg-slate-100"
        >
          Media
        </button>
        {folders.map((entry) => (
          <button
            key={entry}
            type="button"
            onClick={() => setFolder(entry)}
            className="block w-full rounded-md px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100"
          >
            {entry}
          </button>
        ))}
      </aside>
      <main
        className="min-w-0 overflow-auto"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (event.dataTransfer.files.length > 0) {
            mutations.upload.mutate(event.dataTransfer.files);
          }
        }}
      >
        <div className="flex items-center justify-between border-b border-slate-200 bg-white p-4">
          <div>
            <h1 className="text-base font-semibold">{folder || "Media"}</h1>
            <p className="text-sm text-slate-500">{mediaQuery.data?.length ?? 0} items</p>
          </div>
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">
            <UploadIcon className="size-4" />
            Upload
            <input
              multiple
              type="file"
              className="hidden"
              onChange={(event) => {
                if (event.currentTarget.files) mutations.upload.mutate(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
            />
          </label>
        </div>
        <MediaGrid
          items={mediaQuery.data ?? []}
          onOpenFolder={setFolder}
          onDelete={(path) => {
            if (window.confirm(`Delete ${path}?`)) mutations.delete.mutate([path]);
          }}
          onRename={(path) => {
            const currentName = path.split("/").at(-1) ?? path;
            const nextName = window.prompt("New filename", currentName)?.trim();
            if (!nextName) return;
            const parts = path.split("/");
            parts[parts.length - 1] = nextName;
            mutations.move.mutate({ fromPath: path, toPath: parts.join("/") });
          }}
          onMove={(fromPath, toFolder) => {
            mutations.move.mutate({ fromPath, toPath: movePathIntoFolder(fromPath, toFolder) });
          }}
        />
      </main>
    </div>
  );
}

function buildFolderTree(items: Array<{ path: string; folder: string; mimeType: string }>): string[] {
  const folders = new Set<string>();
  for (const item of items) {
    if (item.mimeType === "application/x-directory") {
      folders.add(item.path);
    }
    const parts = item.folder.split("/").filter(Boolean);
    for (let index = 1; index <= parts.length; index++) {
      folders.add(parts.slice(0, index).join("/"));
    }
  }
  return [...folders].sort((a, b) => a.localeCompare(b));
}
