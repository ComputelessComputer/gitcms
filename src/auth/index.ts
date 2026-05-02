import { getEnv } from "../env";
import { AdminUnauthorizedError, GitcmsConfigError } from "../lib/errors";
import type { AuthAdapter, AuthIdentity } from "./adapter";
import { GitHubOAuthAdapter } from "./github-oauth-adapter";
import {
  OAuthTokenSource,
  ServiceTokenSource,
  type GitHubTokenSource,
} from "./github-token-source";
import { JwtAuthAdapter } from "./jwt-adapter";
import { EnvMembersProvider, type Member, type MembersProvider } from "./members";

let cachedAdapter: AuthAdapter | null = null;
let cachedMembers: MembersProvider | null = null;
let cachedTokenSource: GitHubTokenSource | null = null;

/** Returns the configured AuthAdapter. Defaults to GitHub OAuth.
 *  Cached for the process lifetime; use resetAuthForTests() in tests. */
export function getAuthAdapter(): AuthAdapter {
  if (cachedAdapter) return cachedAdapter;
  const env = getEnv();
  switch (env.GITCMS_AUTH_MODE) {
    case "jwt":
      cachedAdapter = new JwtAuthAdapter();
      break;
    case "github":
    default:
      cachedAdapter = new GitHubOAuthAdapter();
      break;
  }
  return cachedAdapter;
}

/** Returns the configured MembersProvider. */
export function getMembersProvider(): MembersProvider {
  if (cachedMembers) return cachedMembers;
  cachedMembers = new EnvMembersProvider();
  return cachedMembers;
}

/** Returns the configured GitHubTokenSource. Defaults match the auth adapter:
 *  GitHub OAuth -> oauth, JWT -> service. Override with GITCMS_GITHUB_TOKEN_SOURCE. */
export function getGitHubTokenSource(): GitHubTokenSource {
  if (cachedTokenSource) return cachedTokenSource;
  const env = getEnv();

  // Sensible default: when AUTH_MODE=jwt, OAuth tokens are unavailable so
  // service is the only working choice. We still let users opt in explicitly.
  const source =
    env.GITCMS_GITHUB_TOKEN_SOURCE ??
    (env.GITCMS_AUTH_MODE === "jwt" ? "service" : "oauth");

  switch (source) {
    case "service":
      cachedTokenSource = new ServiceTokenSource();
      break;
    case "oauth":
      if (env.GITCMS_AUTH_MODE !== "github") {
        throw new GitcmsConfigError(
          "GITCMS_GITHUB_TOKEN_SOURCE=oauth requires GITCMS_AUTH_MODE=github. " +
            "Use GITCMS_GITHUB_TOKEN_SOURCE=service with a fixed PAT for non-GitHub auth.",
        );
      }
      cachedTokenSource = new OAuthTokenSource();
      break;
    default:
      throw new GitcmsConfigError(`Unknown GITCMS_GITHUB_TOKEN_SOURCE: ${source}`);
  }
  return cachedTokenSource;
}

/** Resolves the current identity, gates on membership, and returns both. Used
 *  inside server functions to enforce admin access in one call. */
export async function requireMember(): Promise<{
  identity: AuthIdentity;
  member: Member;
}> {
  const adapter = getAuthAdapter();
  const identity = await adapter.resolveIdentityFromContext();
  if (!identity) {
    throw new AdminUnauthorizedError();
  }
  const member = await getMembersProvider().resolve(identity);
  if (!member) {
    throw new AdminUnauthorizedError(
      identity.email
        ? `${identity.email} is not in GITCMS_MEMBERS.`
        : `${identity.login ?? identity.subject} is not in GITCMS_MEMBERS.`,
    );
  }
  return { identity, member };
}

/** Resolves the current GitHub token for content writes, given a verified
 *  identity. Use after requireMember() inside server functions. */
export async function getGitHubTokenForIdentity(identity: AuthIdentity): Promise<string> {
  return getGitHubTokenSource().getToken(identity);
}

/** Test-only hook to clear the cached singletons. */
export function resetAuthForTests(): void {
  cachedAdapter = null;
  cachedMembers = null;
  cachedTokenSource = null;
}
