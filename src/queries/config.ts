import { queryOptions } from "@tanstack/react-query";

import { configGet } from "../server/fn/config";

export const configKeys = {
  runtime: ["config", "runtime"] as const,
};

/** Query options for the public gitcms runtime config. */
export function runtimeConfigQueryOptions() {
  return queryOptions({
    queryKey: configKeys.runtime,
    queryFn: () => configGet(),
    staleTime: 5 * 60_000,
  });
}
