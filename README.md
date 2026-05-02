# gitcms

**gitcms** — a self-hostable, open-source CMS where your content lives in a git repo and your media lives wherever you want. Bring your own GitHub repo. Bring your own storage (Supabase, S3, R2, B2, MinIO, GitHub itself, or local disk). Edit markdown with a real WYSIWYG editor. Ships with a one-click deploy to Railway.

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

## Features

- GitHub OAuth sign-in with an env-based admin allowlist.
- GitHub-backed content editing for any `owner/repo`.
- Config-driven collections from `gitcms.config.ts`.
- Tiptap WYSIWYG markdown editing with frontmatter fields.
- Save to working branches, publish through pull requests, or direct commit.
- Media library with signed browser uploads, folders, move, rename, and delete.
- Pluggable storage adapters for Supabase, S3-compatible providers, and GitHub itself.
- Docker, Railway, Fly.io, Vercel, and Netlify deployment config.

## Quickstart

```bash
git clone https://github.com/ComputelessComputer/gitcms
cd gitcms
pnpm install
cp .env.example .env
cp examples/gitcms.config.example.ts gitcms.config.ts
pnpm dev
```

Create a GitHub OAuth app with callback URL:

```text
http://localhost:3000/auth/callback
```

Fill the required values in `.env`:

```bash
GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...
GITHUB_OAUTH_CALLBACK_URL=http://localhost:3000/auth/callback
SESSION_SECRET=replace-with-32-plus-random-characters
GITCMS_ADMIN_LOGINS=your-github-login
```

Then choose storage.

### Supabase Storage

```bash
GITCMS_STORAGE_BACKEND=supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_MEDIA_BUCKET=gitcms-media
```

Run `supabase/migrations/0001_initial.sql` in your Supabase project.

### S3-Compatible Storage

```bash
GITCMS_STORAGE_BACKEND=s3
S3_ENDPOINT=https://s3.amazonaws.com
S3_REGION=us-east-1
S3_BUCKET=gitcms-media
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_PUBLIC_URL_BASE=https://cdn.example.com
S3_FORCE_PATH_STYLE=false
```

Use `S3_FORCE_PATH_STYLE=true` for R2, B2, MinIO, and similar providers.

## Storage Adapter Table

| Adapter | Status | Notes |
| --- | --- | --- |
| Supabase | Built in | Uses service-role credentials server-side and signed upload URLs client-side. |
| S3-compatible | Built in | Works with AWS S3, R2, B2, MinIO, and Spaces. |
| Local disk | Development | Read/download support; direct browser uploads are intentionally disabled in v0.0.1. |

## Collections

Declare collections in `gitcms.config.ts`:

```ts
import { defineConfig } from "gitcms/config";

export default defineConfig({
  content: {
    repo: "alice/my-blog",
    branch: "main",
    path: "content",
    workingBranchPrefix: "gitcms/",
  },
  collections: [
    {
      id: "blog",
      label: "Blog Posts",
      path: "blog",
      bodyFormat: "markdown",
      schema: {
        title: { type: "string", required: true },
        date: { type: "date", required: true },
        tags: { type: "string-array" },
        draft: { type: "boolean", default: false },
      },
    },
  ],
});
```

See [docs/COLLECTIONS.md](docs/COLLECTIONS.md) for every field type.

## Deploy

- Docker: `docker build -t gitcms .`
- Railway: use `railway.toml`.
- Fly.io: use `fly.toml`.
- Vercel: use `vercel.json`.
- Netlify: use `netlify.toml`.

See [docs/DEPLOY.md](docs/DEPLOY.md) for platform-specific setup.

## Development

```bash
pnpm typecheck
pnpm test
pnpm build
```

## Contributing

Keep the app small, config-driven, and vendor-neutral. Storage backends should implement `StorageAdapter`; content behavior should go through the GitHub content layer; UI routes should stay thin.

## License

MIT
