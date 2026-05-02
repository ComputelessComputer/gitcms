import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { getAuthAdapter } from "../../auth";
import { toPublicIdentity, type PublicAuthIdentity } from "../../auth/adapter";
import { GitcmsConfigError } from "../../lib/errors";

/** Starts an interactive sign-in. Returns a redirect URL the browser
 *  should navigate to. Errors when the configured auth mode is non-interactive
 *  (e.g. JWT) — those modes get their tokens from the upstream provider. */
export const authStart = createServerFn({ method: "POST" })
  .inputValidator(z.object({}))
  .handler(async (): Promise<{ url: string }> => {
    const adapter = getAuthAdapter();
    if (!adapter.supportsInteractiveSignIn) {
      throw new GitcmsConfigError(
        `Auth mode "${adapter.name}" does not handle sign-in. Configure your upstream provider directly.`,
      );
    }
    const { redirectUrl } = await adapter.startSignIn();
    return { url: redirectUrl };
  });

/** Completes an interactive sign-in callback. */
export const authComplete = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      code: z.string().min(1),
      state: z.string().min(1),
    }),
  )
  .handler(async ({ data }): Promise<PublicAuthIdentity> => {
    const adapter = getAuthAdapter();
    const identity = await adapter.completeSignIn(data);
    return toPublicIdentity(identity);
  });

/** Clears the current admin session. */
export const authSignOut = createServerFn({ method: "POST" })
  .inputValidator(z.object({}))
  .handler(async (): Promise<{ success: true }> => {
    await getAuthAdapter().signOut();
    return { success: true };
  });

/** Returns the current public identity, or null when signed out. */
export const authCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicAuthIdentity | null> => {
    const identity = await getAuthAdapter().resolveIdentityFromContext();
    return identity ? toPublicIdentity(identity) : null;
  },
);
