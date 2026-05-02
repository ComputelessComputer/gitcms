import type { QueryClient } from "@tanstack/react-query";

import type { PublicAuthIdentity } from "./auth/adapter";

export interface RouterContext {
  /** Shared React Query client. */
  queryClient: QueryClient;
  /** Current user loaded by the root route. */
  user: PublicAuthIdentity | null;
}
