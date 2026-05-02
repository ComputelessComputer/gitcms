# Authentication & Authorization

gitcms separates three concerns:

1. **Auth** — proving who's signed in. Pluggable.
2. **Members** — deciding which signed-in users are allowed to use the CMS.
3. **GitHub token** — the credential used to commit content. Decoupled from auth.

You configure these independently with three env vars:

```bash
GITCMS_AUTH_MODE=github         # github | jwt
GITCMS_GITHUB_TOKEN_SOURCE=oauth  # oauth | service
GITCMS_MEMBERS=johnjeong:admin    # who can sign in
```

## Out of the box: GitHub OAuth (default)

Zero extra services. Sign in with GitHub, the same OAuth token is used for content writes, commits are attributed to the human author. This is the recommended setup for solo writers and small teams.

```bash
GITCMS_AUTH_MODE=github
GITCMS_GITHUB_TOKEN_SOURCE=oauth
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...
GITHUB_OAUTH_CALLBACK_URL=https://your-domain.com/auth/callback
SESSION_SECRET=at-least-32-characters
GITCMS_MEMBERS=johnjeong:admin,alice:admin
```

The OAuth callback URL must be registered with your GitHub OAuth app. The session is sealed with iron-session (httpOnly, sameSite=lax, secure in production) and lives 7 days.

## Production: JWT (Clerk, WorkOS, Auth0, Supabase Auth, …)

Use any OIDC-compatible identity provider. gitcms verifies the JWT signature against the provider's JWKS on every request — fully stateless, no session of its own.

```bash
GITCMS_AUTH_MODE=jwt
GITCMS_AUTH_JWT_ISSUER=https://your-tenant.clerk.accounts.dev
GITCMS_AUTH_JWT_AUDIENCE=gitcms
GITCMS_AUTH_JWT_JWKS_URL=https://your-tenant.clerk.accounts.dev/.well-known/jwks.json

# Default claim names cover Clerk, Auth0, Supabase Auth, WorkOS. Override
# only if your provider uses non-standard claim names.
GITCMS_AUTH_JWT_CLAIM_SUBJECT=sub
GITCMS_AUTH_JWT_CLAIM_EMAIL=email
GITCMS_AUTH_JWT_CLAIM_LOGIN=preferred_username
GITCMS_AUTH_JWT_CLAIM_NAME=name
GITCMS_AUTH_JWT_CLAIM_AVATAR=picture

# Where gitcms looks for the bearer token — Authorization header is checked
# first, then this cookie.
GITCMS_AUTH_JWT_COOKIE_NAME=gitcms_jwt

# JWT mode CANNOT use OAuth tokens. Configure a service token instead.
GITCMS_GITHUB_TOKEN_SOURCE=service
GITCMS_GITHUB_SERVICE_TOKEN=ghp_***

# Members are matched on the configured email/subject claim.
GITCMS_MEMBERS=john@fastrepl.com:admin,alice@fastrepl.com:admin
```

Your frontend (or upstream auth proxy) is responsible for issuing the JWT and putting it on the request. Two common patterns:

- **Frontend mints JWT** — use Clerk's `getToken({ template: "gitcms" })` or your provider's equivalent, set as a cookie or sent as Authorization header.
- **Reverse proxy injects JWT** — Cloudflare Access, Pomerium, or oauth2-proxy issuing JWTs through their identity-aware proxy.

## Members

`GITCMS_MEMBERS` is a comma-separated allowlist. The format is `identifier:role`:

```bash
GITCMS_MEMBERS=johnjeong:admin,john@fastrepl.com:admin,jwt:user_abc:admin
```

Identifiers are matched case-insensitively, in this order:

1. `identity.login` (GitHub mode: the GitHub username)
2. `identity.email` (JWT mode: the configured email claim)
3. `identity.subject` (fallback: `github:johnjeong` or `jwt:user_abc`)

`role` is optional and defaults to `admin`. Only `admin` is supported in v0.1; editor and viewer land when team workflows ship.

**Backwards compatibility:** if `GITCMS_MEMBERS` is unset and the legacy `GITCMS_ADMIN_LOGINS` is set, gitcms uses the legacy var as if every entry were `:admin`. New deployments should use `GITCMS_MEMBERS`.

## GitHub token sources

The CMS needs a GitHub token to commit content. Two sources, picked with `GITCMS_GITHUB_TOKEN_SOURCE`:

| Source | When to use | Commit attribution |
|---|---|---|
| `oauth` | `AUTH_MODE=github`. The user's own OAuth token signs commits. | Human author |
| `service` | Any non-GitHub auth mode, or when you want clean bot-only commits. | Bot (set `GITCMS_GITHUB_SERVICE_TOKEN`) |

When using `service` source with non-GitHub auth, add a `Co-authored-by` trailer to commit messages so the human author is preserved in git history. Future versions will do this automatically.

The service token can be:

- A **fine-grained personal access token** (PAT) scoped to `contents:write` on the content repo only. Simplest setup.
- A **GitHub App installation token**. Best for production — auditable, revocable per-install, no user account dependency.

## Compatibility matrix

| Auth mode | Token source | Use case |
|---|---|---|
| `github` | `oauth` | Solo dev, small team. Default. Per-author commits. |
| `github` | `service` | Solo dev who prefers a tidy bot-attributed git log. |
| `jwt` | `service` | Team using SSO (Clerk, WorkOS, Auth0, Supabase Auth, …). |
| `jwt` | `oauth` | ❌ Invalid — JWT users have no GitHub OAuth token. |

## Threat model

- **Session cookie** (`github` mode): sealed with iron-session AES-GCM, httpOnly, sameSite=lax, secure in production. Holds the user's GitHub OAuth token. Compromise of `SESSION_SECRET` lets an attacker forge sessions; rotate immediately if leaked.
- **JWT verification** (`jwt` mode): RS256/ES256 signatures checked against provider JWKS. Issuer and audience must match exactly. Tokens are re-verified on every request (stateless).
- **Members allowlist**: gitcms refuses any signed-in user not in `GITCMS_MEMBERS`. This is the only authorization gate — make sure no one outside the allowlist can issue a valid token in JWT mode.
- **Service token** (`service` source): a single highly-privileged credential. Treat like a database password. Use a fine-grained PAT or GitHub App installation token to limit blast radius.
