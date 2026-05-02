/// <reference types="vite/client" />

import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  redirect,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import { Header } from "../components/header";
import { authCurrentUser } from "../server/fn/auth";
import type { RouterContext } from "../router-context";
import "../styles.css";

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "gitcms" },
    ],
  }),
  beforeLoad: async ({ location }) => {
    if (location.pathname.startsWith("/api/")) {
      return { user: null };
    }

    const user = await authCurrentUser();
    const isAuthRoute = location.pathname.startsWith("/auth/");
    if (!user && !isAuthRoute) {
      throw redirect({ to: "/auth/signin" });
    }
    if (user && location.pathname === "/auth/signin") {
      throw redirect({ to: "/collections" });
    }
    return { user };
  },
  component: RootComponent,
});

function RootComponent(): React.ReactElement {
  const { user } = Route.useRouteContext();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const showHeader = Boolean(user && !pathname.startsWith("/auth/"));

  return (
    <RootDocument>
      {showHeader && user ? <Header user={user} /> : null}
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: Readonly<{ children: ReactNode }>): React.ReactElement {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
