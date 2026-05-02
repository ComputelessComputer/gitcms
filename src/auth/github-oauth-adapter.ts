import { createOAuthAppAuth } from "@octokit/auth-oauth-app";
import { Octokit } from "@octokit/rest";

import { getEnv } from "../env";
import { GitcmsConfigError, GitHubReauthError } from "../lib/errors";
import type { AuthAdapter, AuthIdentity } from "./adapter";
import {
  clearAdminSession,
  createOauthState,
  readAdminSession,
  readAdminSessionFromCookieHeader,
  readOauthState,
  writeAdminSession,
} from "./session";

interface GitHubUserResponse {
  login: string;
  name: string | null;
  avatar_url: string | null;
  email: string | null;
}

/** AuthAdapter that performs the GitHub OAuth dance and persists a sealed
 *  iron-session cookie containing the user's GitHub access token. The token
 *  is later used by OAuthTokenSource for content writes. */
export class GitHubOAuthAdapter implements AuthAdapter {
  readonly name = "github";
  readonly supportsInteractiveSignIn = true;

  /** Builds the GitHub authorize URL and stashes a CSRF state cookie. */
  async startSignIn(): Promise<{ redirectUrl: string }> {
    const env = getEnv();
    if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CALLBACK_URL) {
      throw new GitcmsConfigError(
        "GitHub OAuth requires GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CALLBACK_URL.",
      );
    }
    const state = await createOauthState();
    const url = new URL("https://github.com/login/oauth/authorize");
    url.searchParams.set("client_id", env.GITHUB_OAUTH_CLIENT_ID);
    url.searchParams.set("redirect_uri", env.GITHUB_OAUTH_CALLBACK_URL);
    url.searchParams.set("scope", "repo read:user");
    url.searchParams.set("state", state);
    return { redirectUrl: url.toString() };
  }

  /** Exchanges the OAuth code for a token, fetches the GitHub user, and
   *  writes the session cookie. The access token is stored in metadata so
   *  OAuthTokenSource can recover it for octokit calls. */
  async completeSignIn(params: { code?: string; state?: string }): Promise<AuthIdentity> {
    const env = getEnv();
    if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) {
      throw new GitcmsConfigError(
        "GitHub OAuth requires GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET.",
      );
    }
    if (!params.code || !params.state) {
      throw new GitHubReauthError("Missing OAuth code or state.");
    }

    const expectedState = await readOauthState();
    if (!expectedState || expectedState !== params.state) {
      throw new GitHubReauthError("GitHub OAuth state did not match. Start sign-in again.");
    }

    const auth = createOAuthAppAuth({
      clientType: "oauth-app",
      clientId: env.GITHUB_OAUTH_CLIENT_ID,
      clientSecret: env.GITHUB_OAUTH_CLIENT_SECRET,
    });
    const authentication = await auth({
      type: "oauth-user",
      code: params.code,
      state: params.state,
    });
    if (authentication.type !== "token") {
      throw new GitHubReauthError("GitHub did not return an OAuth access token.");
    }

    const octokit = new Octokit({ auth: authentication.token });
    const { data } = await octokit.request("GET /user");
    const user = data as GitHubUserResponse;

    const identity: AuthIdentity = {
      subject: `github:${user.login.toLowerCase()}`,
      login: user.login,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
      metadata: { accessToken: authentication.token },
    };

    await writeAdminSession({
      login: user.login,
      name: user.name,
      avatarUrl: user.avatar_url,
      accessToken: authentication.token,
    });
    return identity;
  }

  /** Resolves identity from a Request's Cookie header. */
  async resolveIdentity(request: Request): Promise<AuthIdentity | null> {
    const session = await readAdminSessionFromCookieHeader(request.headers.get("cookie") ?? "");
    return session ? this.identityFromSession(session) : null;
  }

  /** Resolves identity from the ambient TanStack Start request context. */
  async resolveIdentityFromContext(): Promise<AuthIdentity | null> {
    const session = await readAdminSession();
    return session ? this.identityFromSession(session) : null;
  }

  async signOut(): Promise<void> {
    clearAdminSession();
  }

  private identityFromSession(session: {
    login: string;
    name: string | null;
    avatarUrl: string | null;
    accessToken: string;
  }): AuthIdentity {
    return {
      subject: `github:${session.login.toLowerCase()}`,
      login: session.login,
      email: null,
      name: session.name,
      avatarUrl: session.avatarUrl,
      metadata: { accessToken: session.accessToken },
    };
  }
}
