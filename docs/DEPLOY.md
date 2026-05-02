# Deploy gitcms

gitcms is a single TanStack Start app. Every platform needs the same runtime inputs:

1. A GitHub OAuth app with callback URL `https://YOUR_DOMAIN/auth/callback`.
2. `gitcms.config.ts` checked into the app root or mounted at `GITCMS_CONFIG_PATH`.
3. A media backend: Supabase Storage or any S3-compatible bucket.
4. A 32+ character `SESSION_SECRET`.
5. `GITCMS_ADMIN_LOGINS` set to the GitHub logins allowed to use the CMS.

## Docker

Build the image:

```bash
docker build -t gitcms .
```

Run with an env file:

```bash
docker run --env-file .env -p 3000:3000 gitcms
```

The container starts `node .output/server/index.mjs` and listens on port `3000`.

## Railway

Use `railway.toml` as-is. Create a new Railway project from the GitHub repository, add all variables from `.env.example`, and deploy. Railway builds the Dockerfile and uses `/auth/signin` as a health check.

## Fly.io

Create the app and secrets:

```bash
fly launch --no-deploy
fly secrets set SESSION_SECRET=... GITHUB_OAUTH_CLIENT_ID=... GITHUB_OAUTH_CLIENT_SECRET=...
fly deploy
```

Update `app = "gitcms"` in `fly.toml` if your Fly app name differs.

## Vercel

Import the repository in Vercel — `vercel.json` already sets the build command to `NITRO_PRESET=vercel pnpm build`, which makes nitro emit Vercel's Build Output API v3 layout under `.vercel/output/`. Add the env vars from `.env.example` in the Vercel dashboard and point your GitHub OAuth callback at the Vercel production domain.

## Netlify

`netlify.toml` runs `NITRO_PRESET=netlify pnpm build`, which produces a Netlify server function under `.netlify/functions-internal/server/` plus static assets in `dist/` (with the `_redirects` file nitro generates for SSR routing). Add the same environment variables in Netlify and deploy from Git.

## Required Variables

Start from `.env.example`. For Supabase storage, fill:

```bash
GITCMS_STORAGE_BACKEND=supabase
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_MEDIA_BUCKET=gitcms-media
```

For S3-compatible storage, fill:

```bash
GITCMS_STORAGE_BACKEND=s3
S3_ENDPOINT=...
S3_REGION=...
S3_BUCKET=...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=true
```
