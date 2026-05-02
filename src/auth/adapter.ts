/** Shape of a signed-in user, normalized across auth providers. */
export interface AuthIdentity {
  /** Stable provider-scoped ID, e.g. "github:johnjeong" or "jwt:user_abc123". */
  subject: string;
  /** Human-readable handle, e.g. GitHub login. May be null. */
  login: string | null;
  /** Email address, when the provider exposes one. */
  email: string | null;
  /** Display name. */
  name: string | null;
  /** Profile image URL. */
  avatarUrl: string | null;
  /** Provider-specific opaque payload persisted in the session.
   *  GitHubOAuthAdapter stores `accessToken` here; JwtAuthAdapter does not. */
  metadata?: Record<string, unknown>;
}

/** Public-safe view of an identity. Strips metadata so tokens never leak to the browser. */
export interface PublicAuthIdentity {
  subject: string;
  login: string | null;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
}

/** Strips internal metadata before returning an identity to the client. */
export function toPublicIdentity(identity: AuthIdentity): PublicAuthIdentity {
  return {
    subject: identity.subject,
    login: identity.login,
    email: identity.email,
    name: identity.name,
    avatarUrl: identity.avatarUrl,
  };
}

/** Pluggable authentication backend. gitcms ships with a GitHub OAuth adapter
 *  (zero-config default) and a JWT adapter (production SSO via Clerk, WorkOS,
 *  Auth0, Supabase Auth, or any OIDC-compatible provider). */
export interface AuthAdapter {
  /** Identifier used in env config and logs (e.g. "github", "jwt"). */
  readonly name: string;

  /** Whether this adapter participates in browser sign-in flows. JWT-style
   *  adapters that consume external tokens return false here. */
  readonly supportsInteractiveSignIn: boolean;

  /** Begins an interactive sign-in. Returns a redirect URL the browser
   *  should navigate to. Throws when supportsInteractiveSignIn is false. */
  startSignIn(): Promise<{ redirectUrl: string }>;

  /** Completes an interactive sign-in callback. Returns the resolved identity.
   *  Implementations are responsible for persisting the session. */
  completeSignIn(params: { code?: string; state?: string }): Promise<AuthIdentity>;

  /** Resolves the current identity for an incoming request. Returns null when
   *  no valid session exists. Always implemented. */
  resolveIdentity(request: Request): Promise<AuthIdentity | null>;

  /** Resolves the current identity from the ambient TanStack Start request
   *  context (no Request object available — used inside server functions). */
  resolveIdentityFromContext(): Promise<AuthIdentity | null>;

  /** Clears the current session. */
  signOut(): Promise<void>;
}
