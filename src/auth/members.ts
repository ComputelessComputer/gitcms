import { getEnv } from "../env";
import type { AuthIdentity } from "./adapter";

/** A member's authorization within gitcms. v0.1 only models admin; editor /
 *  viewer roles will land when team workflows ship. */
export interface Member {
  /** Identifier matching how the upstream auth provider names users.
   *  - For GitHub OAuth this is the lowercased login.
   *  - For JWT auth this is typically the email or sub claim. */
  identifier: string;
  role: "admin";
}

/** Resolves an authenticated identity to a Member, or null when the user is
 *  authenticated but not authorized. */
export interface MembersProvider {
  resolve(identity: AuthIdentity): Promise<Member | null>;
}

/** MembersProvider backed by a comma-separated env var.
 *
 *  Format: `identifier:role,identifier:role,...`
 *  - When :role is omitted, defaults to admin.
 *  - Identifier is matched case-insensitively against:
 *      - GitHub mode: identity.login
 *      - JWT/other modes: identity.email then identity.subject
 *
 *  For backwards compatibility with v0.0.x, falls back to GITCMS_ADMIN_LOGINS
 *  (which only encoded GitHub logins) when GITCMS_MEMBERS is unset. */
export class EnvMembersProvider implements MembersProvider {
  private readonly members: Map<string, Member>;

  constructor(spec?: string) {
    const raw = spec ?? this.readEnvSpec();
    this.members = parseMembersSpec(raw);
  }

  async resolve(identity: AuthIdentity): Promise<Member | null> {
    if (this.members.size === 0) {
      // Empty allowlist means "no one is allowed" — explicit gating wins
      // over the looser v0.0 default. Surface this with a clear error from
      // the calling layer rather than silently letting everyone through.
      return null;
    }

    const candidates = [identity.login, identity.email, identity.subject]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());

    for (const key of candidates) {
      const member = this.members.get(key);
      if (member) return member;
    }
    return null;
  }

  /** Reads the env spec, preferring GITCMS_MEMBERS but falling back to the
   *  legacy GITCMS_ADMIN_LOGINS for backwards compatibility. */
  private readEnvSpec(): string {
    const env = getEnv();
    if (env.GITCMS_MEMBERS) return env.GITCMS_MEMBERS;
    if (env.GITCMS_ADMIN_LOGINS) {
      // Legacy logins are GitHub usernames with implicit admin role.
      return env.GITCMS_ADMIN_LOGINS;
    }
    return "";
  }
}

/** Parses a `id:role,id:role` spec into a lookup table. Identifiers are
 *  lowercased to match the lookup in `resolve`. The role separator is the
 *  LAST colon in an entry, so identifiers may themselves contain colons
 *  (useful for JWT subjects like `jwt:user_abc`). */
export function parseMembersSpec(spec: string): Map<string, Member> {
  const out = new Map<string, Member>();
  for (const entry of spec.split(",")) {
    const trimmed = entry.trim();
    if (!trimmed) continue;
    const lastColon = trimmed.lastIndexOf(":");
    let rawId: string;
    let rawRole: string | undefined;
    // A trailing token is treated as a role only if it's a known role name —
    // otherwise the whole entry is the identifier (e.g. "jwt:user_abc" with
    // no explicit role should be admin, not parsed as identifier "jwt" / role
    // "user_abc").
    const tail = lastColon >= 0 ? trimmed.slice(lastColon + 1).trim() : "";
    if (lastColon >= 0 && tail === "admin") {
      rawId = trimmed.slice(0, lastColon).trim();
      rawRole = tail;
    } else {
      rawId = trimmed;
    }
    const identifier = rawId.toLowerCase();
    if (!identifier) continue;
    const role = (rawRole?.trim() || "admin") as Member["role"];
    if (role !== "admin") continue;
    out.set(identifier, { identifier, role });
  }
  return out;
}
