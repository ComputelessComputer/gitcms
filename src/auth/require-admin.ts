import { getGitHubTokenForIdentity, requireMember } from "./index";
import type { AuthIdentity } from "./adapter";
import type { Member } from "./members";

/** Authenticated context returned to server-fn handlers. */
export interface AdminContext {
  /** The verified upstream identity. */
  identity: AuthIdentity;
  /** The matched gitcms member entry. */
  member: Member;
  /** GitHub token for content writes. Source depends on
   *  GITCMS_GITHUB_TOKEN_SOURCE — could be the user's OAuth token or a
   *  fixed service token. Either way, it's safe to hand to octokit. */
  accessToken: string;
}

/** Requires an authenticated, authorized member inside a server function.
 *  Throws AdminUnauthorizedError when not signed in or not a member.
 *
 *  Replaces the v0.0.x signature: previously returned just `AdminSession`,
 *  now returns the full AdminContext including a token for content writes. */
export async function requireAdminServerFn(): Promise<AdminContext> {
  const { identity, member } = await requireMember();
  const accessToken = await getGitHubTokenForIdentity(identity);
  return { identity, member, accessToken };
}
