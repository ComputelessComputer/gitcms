import { FileTextIcon, FolderIcon } from "lucide-react";
import * as React from "react";

import type { CollectionDescriptor } from "../config";
import type { ContentTreeItem } from "../github/types";
import { Button } from "./ui/button";
import { cn } from "./ui/utils";

export interface FileTreeProps {
  /** Configured collections. */
  collections: CollectionDescriptor[];
  /** Active collection ID. */
  collectionId: string;
  /** Files for the active collection. */
  files: ContentTreeItem[];
  /** Selected repository path. */
  selectedPath: string;
  /** Collection selection handler. */
  onCollectionChange: (collectionId: string) => void;
  /** File selection handler. */
  onFileSelect: (path: string) => void;
  /** New-file command handler. */
  onNewFile: () => void;
}

/** Collection and file tree sidebar. */
export function FileTree({
  collections,
  collectionId,
  files,
  selectedPath,
  onCollectionChange,
  onFileSelect,
  onNewFile,
}: FileTreeProps): React.ReactElement {
  return (
    <aside className="flex h-full flex-col border-r border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-3">
        <Button className="w-full" size="sm" variant="primary" onClick={onNewFile}>
          New
        </Button>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-slate-200 p-2">
        {collections.map((collection) => (
          <Button
            key={collection.id}
            size="sm"
            variant={collection.id === collectionId ? "primary" : "ghost"}
            onClick={() => onCollectionChange(collection.id)}
          >
            {collection.label}
          </Button>
        ))}
      </div>
      <nav className="min-h-0 flex-1 overflow-auto p-2">
        {files.map((file) => (
          <button
            key={file.path}
            type="button"
            onClick={() => file.type === "file" && onFileSelect(file.path)}
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100",
              selectedPath === file.path && "bg-teal-50 text-teal-900",
              file.type === "dir" && "font-medium text-slate-500",
            )}
          >
            {file.type === "dir" ? <FolderIcon className="size-4" /> : <FileTextIcon className="size-4" />}
            <span className="truncate">{file.name}</span>
          </button>
        ))}
      </nav>
    </aside>
  );
}
