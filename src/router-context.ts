import type { QueryClient } from "@tanstack/react-query";

import type { PublicAdminUser } from "./auth/session";

export interface RouterContext {
  /** Shared React Query client. */
  queryClient: QueryClient;
  /** Current user loaded by the root route. */
  user: PublicAdminUser | null;
}
