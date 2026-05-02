import { createFileRoute } from "@tanstack/react-router";
import { GitBranch as GithubIcon } from "lucide-react";
import * as React from "react";

import { Button } from "../../components/ui/button";
import { startGitHubSignIn } from "../../queries/auth";

export const Route = createFileRoute("/auth/signin")({
  component: SignInPage,
});

function SignInPage(): React.ReactElement {
  const [error, setError] = React.useState<string | null>(null);

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <section className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-950">gitcms</h1>
        <p className="mt-2 text-sm text-slate-600">Sign in with an authorized GitHub account.</p>
        <Button
          className="mt-6 w-full"
          variant="primary"
          onClick={() => {
            startGitHubSignIn().catch((caught) => {
              setError(caught instanceof Error ? caught.message : "Unable to start sign-in.");
            });
          }}
        >
          <GithubIcon className="size-4" />
          Sign in with GitHub
        </Button>
        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      </section>
    </main>
  );
}
