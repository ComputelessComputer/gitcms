import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { createRouter as createTanStackRouter } from "@tanstack/react-router";
import * as React from "react";

import { adminQueryRetry, handleAdminQueryError } from "./queries/error-policy";
import type { RouterContext } from "./router-context";
import { routeTree } from "./routeTree.gen";

/** Creates the TanStack Router instance with React Query in route context. */
export function getRouter() {
  const queryClient = new QueryClient({
    queryCache: new QueryCache({ onError: handleAdminQueryError }),
    mutationCache: new MutationCache({ onError: handleAdminQueryError }),
    defaultOptions: {
      queries: {
        retry: adminQueryRetry,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: adminQueryRetry,
      },
    },
  });

  const router = createTanStackRouter({
    routeTree,
    context: {
      queryClient,
      user: null,
    } satisfies RouterContext,
    defaultPreload: "intent",
    scrollRestoration: true,
    Wrap: ({ children }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });

  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
