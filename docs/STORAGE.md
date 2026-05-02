# Storage Adapters

gitcms stores media through `StorageAdapter` in `src/storage/types.ts`. The UI never talks to Supabase or S3 directly. It asks the server for a signed upload URL, uploads the bytes from the browser, then registers the item so the media grid can refresh.

## Built-in Backends

| Backend | Env value | Use case |
| --- | --- | --- |
| Supabase Storage | `supabase` | Simple hosted bucket with public URLs |
| S3-compatible | `s3` | AWS S3, Cloudflare R2, Backblaze B2, MinIO, DigitalOcean Spaces |
| Local filesystem | `local` | Development reads/downloads; direct browser upload is intentionally disabled in v0.0.1 |

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
