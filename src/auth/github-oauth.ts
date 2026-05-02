import { createOAuthAppAuth } from "@octokit/auth-oauth-app";
import { Octokit } from "@octokit/rest";

import { getAdminLogins, getEnv } from "../env";
import { AdminUnauthorizedError, GitcmsConfigError, GitHubReauthError } from "../lib/errors";
import {
  createOauthState,
  readOauthState,
  toPublicAdminUser,
  writeAdminSession,
  type PublicAdminUser,
} from "./session";

interface GitHubUserResponse {
  login: string;
  name: string | null;
  avatar_url: string | null;
}

/** Creates the GitHub authorization URL and stores the CSRF state cookie. */
export async function createGitHubAuthorizeUrl(): Promise<string> {
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
  return url.toString();
}

/** Exchanges a GitHub OAuth callback code for a sealed admin session. */
export async function completeGitHubOAuth(params: {
  code: string;
  state: string;
}): Promise<PublicAdminUser> {
  const env = getEnv();
  if (!env.GITHUB_OAUTH_CLIENT_ID || !env.GITHUB_OAUTH_CLIENT_SECRET) {
    throw new GitcmsConfigError(
      "GitHub OAuth requires GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET.",
    );
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
  const allowed = getAdminLogins(env);
  if (allowed.size > 0 && !allowed.has(user.login.toLowerCase())) {
    throw new AdminUnauthorizedError(`GitHub user ${user.login} is not in GITCMS_ADMIN_LOGINS.`);
  }

  const session = {
    login: user.login,
    name: user.name,
    avatarUrl: user.avatar_url,
    accessToken: authentication.token,
  };
  await writeAdminSession(session);
  return toPublicAdminUser(session);
}
