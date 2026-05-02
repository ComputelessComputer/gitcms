# Storage Adapters

gitcms stores media through `StorageAdapter` in `src/storage/types.ts`. The UI never talks to Supabase or S3 directly. It asks the server for a signed upload URL, uploads the bytes from the browser, then registers the item so the media grid can refresh.

## Built-in Backends

| Backend          | Env value  | Use case                                                                               |
| ---------------- | ---------- | -------------------------------------------------------------------------------------- |
| Supabase Storage | `supabase` | Simple hosted bucket with public URLs                                                  |
| S3-compatible    | `s3`       | AWS S3, Cloudflare R2, Backblaze B2, MinIO, DigitalOcean Spaces — best for production  |
| GitHub repo      | `github`   | Personal blogs and docs sites — small media, no extra service, fully versioned         |
| Local filesystem | `local`    | Development reads/downloads; direct browser upload is intentionally disabled in v0.0.1 |

## Supabase

Set:

```bash
GITCMS_STORAGE_BACKEND=supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_MEDIA_BUCKET=gitcms-media
```

Run `supabase/migrations/0001_initial.sql` to create the `media_assets` catalog table and bucket. The adapter uses the service-role key only on the server.

## S3-Compatible

Set:

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

Use `S3_FORCE_PATH_STYLE=true` for R2, B2, and MinIO. If `S3_PUBLIC_URL_BASE` is set, gitcms uses it for rendered markdown image URLs.

## GitHub

Commit media directly into a GitHub repo. No external storage service required — useful for personal blogs and docs sites where the operational simplicity is worth the trade-offs.

```bash
GITCMS_STORAGE_BACKEND=github
GITCMS_GITHUB_MEDIA_REPO=owner/blog
GITCMS_GITHUB_MEDIA_BRANCH=main          # optional, defaults to repo default
GITCMS_GITHUB_MEDIA_PATH=public/uploads
GITCMS_GITHUB_MEDIA_TOKEN=ghp_***        # fine-grained PAT, contents:write
GITCMS_GITHUB_MEDIA_PUBLIC=true          # raw.githubusercontent.com URLs
GITCMS_GITHUB_MEDIA_PUBLIC_URL_BASE=     # optional CDN/proxy
```

The token can be a fine-grained PAT or a GitHub App installation token. Scope it to **contents:write** on the media repo only — it does not need user data, issues, or workflows.

**Trade-offs you must understand before choosing this backend:**

- **25 MB hard cap per file.** GitHub's Contents API rejects anything larger; gitcms surfaces this as a typed validation error before the request goes out. Anything beyond that needs S3-compatible storage.
- **Every upload, rename, and delete creates a git commit.** History grows fast. Git stores binary blobs poorly — a 2 MB image edited five times is roughly 10 MB on disk forever.
- **No CDN.** Public repos serve through `raw.githubusercontent.com`, which is rate-limited (~5k req/hr unauthenticated) and offers no edge caching guarantees. Set `GITCMS_GITHUB_MEDIA_PUBLIC_URL_BASE` to a Cloudflare proxy or jsDelivr (`https://cdn.jsdelivr.net/gh/owner/blog`) to serve from a CDN.
- **Private repos cannot use direct URLs.** Browser requests for private-repo media route through gitcms's own `/api/media/download` proxy automatically — slower, but private content stays private.
- **Browser uploads go through the gitcms server**, not directly to GitHub, because Octokit needs the bot token. Uploads are limited to 25 MB and pass through the `/api/media/upload` route.

If any of these are deal-breakers, use S3-compatible storage instead — Cloudflare R2 is free up to 10 GB with no egress fees, which is the right answer for almost any production workload.

## Custom Adapter

Implement `StorageAdapter`:

```ts
import type { StorageAdapter } from "./src/storage";

export class MyStorageAdapter implements StorageAdapter {
  async init() {}
  async list(folder, opts) {}
  async createSignedUpload(params) {}
  async move(fromPath, toPath) {}
  async delete(path) {}
  async createFolder(path) {}
  async stream(path) {}
  getPublicUrl(path) {}
}
```

Then add a branch in `src/storage/index.ts` that reads your env vars and returns the adapter. Keep signed upload URLs short-lived and never expose server credentials to the browser.
