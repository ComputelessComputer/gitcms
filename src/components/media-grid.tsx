import { FileIcon, FolderIcon, PencilIcon, Trash2Icon } from "lucide-react";
import * as React from "react";

import type { MediaItem } from "../client/media/library";
import { isImageMedia } from "../client/media/library";
import { Button } from "./ui/button";

export interface MediaGridProps {
  /** Media items to render. */
  items: MediaItem[];
  /** Folder navigation handler. */
  onOpenFolder: (path: string) => void;
  /** Delete command handler. */
  onDelete: (path: string) => void;
  /** Rename command handler. */
  onRename: (path: string) => void;
  /** Move command handler. */
  onMove: (fromPath: string, toFolder: string) => void;
}

/** Grid view for media library files and folders. */
export function MediaGrid({
  items,
  onOpenFolder,
  onDelete,
  onRename,
  onMove,
}: MediaGridProps): React.ReactElement {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-4">
      {items.map((item) => {
        const isFolder = item.mimeType === "application/x-directory";
        return (
          <article
            key={item.path}
            draggable={!isFolder}
            onDragStart={(event) => event.dataTransfer.setData("text/plain", item.path)}
            onDragOver={(event) => {
              if (isFolder) event.preventDefault();
            }}
            onDrop={(event) => {
              const fromPath = event.dataTransfer.getData("text/plain");
              if (isFolder && fromPath) onMove(fromPath, item.path);
            }}
            className="group overflow-hidden rounded-lg border border-slate-200 bg-white"
          >
            <button
              type="button"
              onClick={() => isFolder && onOpenFolder(item.path)}
              className="flex aspect-square w-full items-center justify-center bg-slate-100"
            >
              {isFolder ? (
                <FolderIcon className="size-10 text-slate-500" />
              ) : isImageMedia(item) ? (
                <img src={item.publicUrl} alt={item.name} className="size-full object-cover" />
              ) : (
                <FileIcon className="size-10 text-slate-500" />
              )}
            </button>
            <div className="flex items-center justify-between gap-2 p-2">
              <span className="min-w-0 truncate text-xs text-slate-700" title={item.path}>
                {item.name}
              </span>
              <div className="flex shrink-0 items-center">
                {!isFolder && (
                  <Button size="icon" variant="ghost" aria-label="Rename" onClick={() => onRename(item.path)}>
                    <PencilIcon className="size-4" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" aria-label="Delete" onClick={() => onDelete(item.path)}>
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            </div>
          </article>
        );
      })}
    </div>
  );
}
