import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { createGitHubAuthorizeUrl, completeGitHubOAuth } from "../../auth/github-oauth";
import {
  clearAdminSession,
  readAdminSession,
  toPublicAdminUser,
  type PublicAdminUser,
} from "../../auth/session";

/** Starts the GitHub OAuth flow by returning an authorization URL. */
export const authStart = createServerFn({ method: "POST" })
  .inputValidator(z.object({}))
  .handler(async (): Promise<{ url: string }> => {
    return { url: await createGitHubAuthorizeUrl() };
  });

/** Completes the GitHub OAuth callback and writes the session cookie. */
export const authComplete = createServerFn({ method: "POST" })
  .inputValidator(
    z.object({
      code: z.string().min(1),
      state: z.string().min(1),
    }),
  )
  .handler(async ({ data }): Promise<PublicAdminUser> => {
    return completeGitHubOAuth(data);
  });

/** Clears the current admin session. */
export const authSignOut = createServerFn({ method: "POST" })
  .inputValidator(z.object({}))
  .handler(async (): Promise<{ success: true }> => {
    clearAdminSession();
    return { success: true };
  });

/** Returns the current public admin user, or null when signed out. */
export const authCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<PublicAdminUser | null> => {
    const session = await readAdminSession();
    return session ? toPublicAdminUser(session) : null;
  },
);
