import { createFileRoute, redirect } from "@tanstack/react-router";
import * as React from "react";
import { z } from "zod";

import { authComplete } from "../../server/fn/auth";

const callbackSearchSchema = z.object({
  code: z.string(),
  state: z.string(),
});

export const Route = createFileRoute("/auth/callback")({
  validateSearch: (search) => callbackSearchSchema.parse(search),
  loaderDeps: ({ search }) => ({ search }),
  loader: async ({ deps }) => {
    await authComplete({ data: deps.search });
    throw redirect({ to: "/collections" });
  },
  component: CallbackPage,
});

function CallbackPage(): React.ReactElement {
  return <main className="p-6 text-sm text-slate-600">Completing sign-in...</main>;
}
