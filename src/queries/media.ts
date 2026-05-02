import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import { uploadMediaFile } from "../client/media/upload";
import { mediaCreateFolder, mediaDelete, mediaList, mediaMove } from "../server/fn/media";

export const mediaKeys = {
  all: ["media"] as const,
  folder: (folder: string, recursive = false) => ["media", "folder", folder, recursive] as const,
};

/** Query options for listing a media folder. */
export function mediaFolderQueryOptions(folder: string, recursive = false) {
  return queryOptions({
    queryKey: mediaKeys.folder(folder, recursive),
    queryFn: () => mediaList({ data: { folder, recursive } }).then((result) => result.items),
    staleTime: 30_000,
  });
}

/** Media mutation hooks scoped to a current folder. */
export function useMediaMutations(currentFolder: string) {
  const queryClient = useQueryClient();
  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: mediaKeys.all });
  };

  return {
    upload: useMutation({
      mutationFn: async (files: FileList) => {
        for (const file of Array.from(files)) {
          await uploadMediaFile({ file, folder: currentFolder });
        }
      },
      onSuccess: invalidate,
    }),
    move: useMutation({
      mutationFn: (data: Parameters<typeof mediaMove>[0]["data"]) => mediaMove({ data }),
      onSuccess: invalidate,
    }),
    delete: useMutation({
      mutationFn: (paths: string[]) => mediaDelete({ data: { paths } }),
      onSuccess: invalidate,
    }),
    createFolder: useMutation({
      mutationFn: (path: string) => mediaCreateFolder({ data: { path } }),
      onSuccess: invalidate,
    }),
  };
}
