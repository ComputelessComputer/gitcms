import { queryOptions } from "@tanstack/react-query";

import { contextGet } from "../server/fn/context";

export const contextKeys = {
  all: ["author-context"] as const,
  brief: (collectionId?: string, branch?: string) =>
    ["author-context", "brief", collectionId ?? "_root", branch ?? "_default"] as const,
};

/** Query options for the author writing brief.
 *
 *  Cheap to fetch (small markdown files) but cached aggressively — operators
 *  rarely edit the brief, and refetching on every editor mount would just be
 *  noise. Invalidate manually after a brief edit if/when we surface in-CMS
 *  editing of `.gitcms/` files. */
export function authorContextQueryOptions(collectionId?: string, branch?: string) {
  const data: { collectionId?: string; branch?: string } = {};
  if (collectionId) data.collectionId = collectionId;
  if (branch) data.branch = branch;

  return queryOptions({
    queryKey: contextKeys.brief(collectionId, branch),
    queryFn: () => contextGet({ data }),
    // The brief is operator-edited config-as-content; avoid hammering GitHub.
    staleTime: 5 * 60 * 1000, // 5min
    gcTime: 30 * 60 * 1000, // 30min
  });
}
