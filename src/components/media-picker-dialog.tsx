import { useQuery } from "@tanstack/react-query";
import * as React from "react";

import { isImageMedia } from "../client/media/library";
import { mediaFolderQueryOptions } from "../queries/media";
import { Dialog, DialogContent, DialogTitle } from "./ui/dialog";

export interface MediaPickerDialogProps {
  /** Whether the picker is open. */
  open: boolean;
  /** Open state change handler. */
  onOpenChange: (open: boolean) => void;
  /** Called with the chosen image URL. */
  onSelect: (url: string, alt: string) => void;
}

/** Image picker backed by the media library. */
export function MediaPickerDialog({
  open,
  onOpenChange,
  onSelect,
}: MediaPickerDialogProps): React.ReactElement {
  const mediaQuery = useQuery(mediaFolderQueryOptions("", true));
  const images = (mediaQuery.data ?? []).filter(isImageMedia);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <div className="border-b border-slate-200 p-4">
          <DialogTitle>Choose image</DialogTitle>
        </div>
        <div className="grid max-h-[70vh] grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-3 overflow-auto p-4">
          {images.map((item) => (
            <button
              key={item.path}
              type="button"
              onClick={() => onSelect(item.publicUrl, item.name)}
              className="overflow-hidden rounded-md border border-slate-200 bg-white text-left hover:border-teal-600"
            >
              <img
                src={item.publicUrl}
                alt={item.name}
                className="aspect-square w-full object-cover"
              />
              <span className="block truncate p-2 text-xs text-slate-700">{item.name}</span>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
