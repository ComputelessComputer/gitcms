import { createRemoteJWKSet, jwtVerify, type JWTPayload } from "jose";

import { getEnv } from "../env";
import { AdminUnauthorizedError, GitcmsConfigError } from "../lib/errors";
import type { AuthAdapter, AuthIdentity } from "./adapter";

/** AuthAdapter that consumes JWTs from any OIDC-compatible provider — Clerk,
 *  WorkOS, Auth0, Supabase Auth, your own auth server, anything with a JWKS
 *  endpoint. Stateless: gitcms never holds a session of its own, it just
 *  verifies the token on every request.
 *
 *  Expects the bearer token in either:
 *    - `Authorization: Bearer <jwt>`
 *    - cookie named via GITCMS_AUTH_JWT_COOKIE_NAME (default: `gitcms_jwt`)
 *
 *  Configure which JWT claims map to identity fields via GITCMS_AUTH_JWT_CLAIM_*. */
export class JwtAuthAdapter implements AuthAdapter {
  readonly name = "jwt";
  readonly supportsInteractiveSignIn = false;

  private readonly issuer: string;
  private readonly audience: string;
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly cookieName: string;
  private readonly claimSubject: string;
  private readonly claimEmail: string;
  private readonly claimLogin: string;
  private readonly claimName: string;
  private readonly claimAvatar: string;

  constructor() {
    const env = getEnv();
    if (!env.GITCMS_AUTH_JWT_ISSUER) {
      throw new GitcmsConfigError("AUTH_MODE=jwt requires GITCMS_AUTH_JWT_ISSUER.");
    }
    if (!env.GITCMS_AUTH_JWT_AUDIENCE) {
      throw new GitcmsConfigError("AUTH_MODE=jwt requires GITCMS_AUTH_JWT_AUDIENCE.");
    }
    if (!env.GITCMS_AUTH_JWT_JWKS_URL) {
      throw new GitcmsConfigError("AUTH_MODE=jwt requires GITCMS_AUTH_JWT_JWKS_URL.");
    }

    this.issuer = env.GITCMS_AUTH_JWT_ISSUER;
    this.audience = env.GITCMS_AUTH_JWT_AUDIENCE;
    this.jwks = createRemoteJWKSet(new URL(env.GITCMS_AUTH_JWT_JWKS_URL));
    this.cookieName = env.GITCMS_AUTH_JWT_COOKIE_NAME;
    this.claimSubject = env.GITCMS_AUTH_JWT_CLAIM_SUBJECT;
    this.claimEmail = env.GITCMS_AUTH_JWT_CLAIM_EMAIL;
    this.claimLogin = env.GITCMS_AUTH_JWT_CLAIM_LOGIN;
    this.claimName = env.GITCMS_AUTH_JWT_CLAIM_NAME;
    this.claimAvatar = env.GITCMS_AUTH_JWT_CLAIM_AVATAR;
  }

  async startSignIn(): Promise<{ redirectUrl: string }> {
    throw new GitcmsConfigError(
      "JWT mode does not handle sign-in. Direct users to your upstream auth provider.",
    );
  }

  async completeSignIn(): Promise<AuthIdentity> {
    throw new GitcmsConfigError(
      "JWT mode does not handle sign-in callbacks. The upstream provider issues the token directly.",
    );
  }

  async resolveIdentity(request: Request): Promise<AuthIdentity | null> {
    const token = this.extractToken(request);
    if (!token) return null;
    return this.verifyAndMap(token);
  }

  async resolveIdentityFromContext(): Promise<AuthIdentity | null> {
    // TanStack Start provides request headers via getRequestHeader inside
    // server functions. We dynamically import to avoid pulling the server
    // helpers into client bundles when this adapter isn't active.
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    const authHeader = getRequestHeader("authorization") ?? "";
    const cookieHeader = getRequestHeader("cookie") ?? "";
    const fakeRequest = new Request("http://gitcms.local", {
      headers: { authorization: authHeader, cookie: cookieHeader },
    });
    return this.resolveIdentity(fakeRequest);
  }

  /** No-op: JWT sessions are owned by the upstream provider. */
  async signOut(): Promise<void> {
    /* the upstream provider must clear its own token */
  }

  private extractToken(request: Request): string | null {
    const auth = request.headers.get("authorization");
    if (auth) {
      const match = auth.match(/^Bearer\s+(.+)$/i);
      if (match?.[1]) return match[1].trim();
    }
    const cookieHeader = request.headers.get("cookie");
    if (cookieHeader) {
      const cookies = parseCookieHeader(cookieHeader);
      const token = cookies[this.cookieName];
      if (token) return token;
    }
    return null;
  }

  private async verifyAndMap(token: string): Promise<AuthIdentity | null> {
    let payload: JWTPayload;
    try {
      const result = await jwtVerify(token, this.jwks, {
        issuer: this.issuer,
        audience: this.audience,
      });
      payload = result.payload;
    } catch {
      return null;
    }

    const subject = readClaim(payload, this.claimSubject);
    if (!subject) {
      throw new AdminUnauthorizedError(`JWT is missing required claim "${this.claimSubject}".`);
    }
    return {
      subject: `jwt:${subject}`,
      login: readClaim(payload, this.claimLogin),
      email: readClaim(payload, this.claimEmail),
      name: readClaim(payload, this.claimName),
      avatarUrl: readClaim(payload, this.claimAvatar),
    };
  }
}

function readClaim(payload: JWTPayload, key: string): string | null {
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function parseCookieHeader(header: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}
