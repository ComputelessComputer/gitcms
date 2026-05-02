import { getEnv } from "../env";
import { AdminUnauthorizedError, GitcmsConfigError } from "../lib/errors";
import type { AuthIdentity } from "./adapter";

/** Source of GitHub access tokens used by the content backend (octokit calls
 *  that read/write markdown in the configured content repo).
 *
 *  Decoupled from the AuthAdapter so any auth provider — GitHub OAuth, JWT,
 *  or future modes — can be paired with any token source. */
export interface GitHubTokenSource {
  readonly name: string;
  /** Returns a fresh GitHub token, given the currently signed-in identity. */
  getToken(identity: AuthIdentity): Promise<string>;
}

/** Pulls the GitHub token from the user's session metadata. Only valid when
 *  the auth adapter is GitHub OAuth — the token is what we got from the
 *  OAuth code exchange. Requires the human author actually has GitHub access
 *  to the content repo. */
export class OAuthTokenSource implements GitHubTokenSource {
  readonly name = "oauth";

  async getToken(identity: AuthIdentity): Promise<string> {
    const token = identity.metadata?.accessToken;
    if (typeof token !== "string" || !token) {
      throw new AdminUnauthorizedError(
        "Current auth provider does not produce a GitHub access token. Configure GITCMS_GITHUB_TOKEN_SOURCE=service.",
      );
    }
    return token;
  }
}

/** Returns a fixed GitHub token from env. Use this whenever the auth provider
 *  is not GitHub itself (JWT mode, future SSO modes), or when you want all
 *  commits attributed to a single bot account regardless of who's editing.
 *
 *  Recommended setup: a fine-grained PAT or GitHub App installation token
 *  scoped to the content repo with contents:write. Pair commit messages with
 *  Co-authored-by trailers so the human author is preserved in git history. */
export class ServiceTokenSource implements GitHubTokenSource {
  readonly name = "service";
  private readonly token: string;

  constructor(token?: string) {
    const value = token ?? getEnv().GITCMS_GITHUB_SERVICE_TOKEN;
    if (!value) {
      throw new GitcmsConfigError(
        "GITCMS_GITHUB_TOKEN_SOURCE=service requires GITCMS_GITHUB_SERVICE_TOKEN.",
      );
    }
    this.token = value;
  }

  async getToken(_identity: AuthIdentity): Promise<string> {
    return this.token;
  }
}
