import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query";

import {
  contentDelete,
  contentList,
  contentOpenPR,
  contentRead,
  contentRename,
  contentSave,
} from "../server/fn/content";

export const contentKeys = {
  all: ["content"] as const,
  collection: (collectionId: string) => ["content", "collection", collectionId] as const,
  file: (collectionId: string, path: string, branch?: string) =>
    ["content", "file", collectionId, path, branch ?? "base"] as const,
};

/** Query options for collection file lists. */
export function contentListQueryOptions(collectionId: string) {
  return queryOptions({
    queryKey: contentKeys.collection(collectionId),
    queryFn: () => contentList({ data: { collectionId } }).then((result) => result.items),
    enabled: Boolean(collectionId),
  });
}

/** Query options for reading one content file. */
export function contentFileQueryOptions(collectionId: string, path: string, branch?: string) {
  const data = branch ? { collectionId, path, branch } : { collectionId, path };
  return queryOptions({
    queryKey: contentKeys.file(collectionId, path, branch),
    queryFn: () => contentRead({ data }),
    enabled: Boolean(collectionId && path),
  });
}

/** Mutation hook for saving content. */
export function useContentSaveMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof contentSave>[0]["data"]) => contentSave({ data }),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({
        queryKey: contentKeys.collection(variables.collectionId),
      });
      await queryClient.invalidateQueries({ queryKey: contentKeys.all });
    },
  });
}

/** Mutation hook for renaming content. */
export function useContentRenameMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof contentRename>[0]["data"]) => contentRename({ data }),
    onSuccess: async (_result, variables) => {
      await queryClient.invalidateQueries({
        queryKey: contentKeys.collection(variables.collectionId),
      });
    },
  });
}

/** Mutation hook for deleting content. */
export function useContentDeleteMutation(collectionId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof contentDelete>[0]["data"]) => contentDelete({ data }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: contentKeys.collection(collectionId) });
    },
  });
}

/** Mutation hook for opening a publish pull request. */
export function useContentPublishMutation() {
  return useMutation({
    mutationFn: (data: Parameters<typeof contentOpenPR>[0]["data"]) => contentOpenPR({ data }),
  });
}
