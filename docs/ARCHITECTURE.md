# Architecture

gitcms is a single TanStack Start application. It uses file-based TanStack Router routes, TanStack Query for client data, and `createServerFn` for all JSON RPCs.

## Request Flow

1. `src/routes/__root.tsx` calls `authCurrentUser`.
2. If no encrypted session cookie exists, the user is redirected to `/auth/signin`.
3. `/auth/signin` starts the GitHub OAuth flow with `scope=repo read:user`.
4. `/auth/callback` exchanges the code server-side and stores the GitHub token in an encrypted session cookie.
5. Server functions call `requireAdminServerFn()` before touching GitHub or storage.

The GitHub token is never stored in a database. It exists only inside the sealed cookie and server memory during a request.

## Content Layer

`src/github/*` treats GitHub as the CMS database:

| Module | Responsibility |
| --- | --- |
| `client.ts` | Octokit factory and `owner/repo` parsing |
| `content-paths.ts` | repo path and branch naming helpers |
| `branches.ts` | branch and pull request helpers |
| `content.ts` | list, read, save, rename, delete, publish |

Markdown files are serialized with YAML frontmatter by `src/lib/markdown.ts`.

## Storage Layer

The media UI depends only on `StorageAdapter`. Supabase and S3-compatible backends implement the same interface: list, signed upload, move, delete, folder marker, streaming download, and public URL generation.

`/api/media/download` is the only HTTP route because server functions are not used for streaming binary responses.

## Client UI

Feature routes under `src/routes` are thin and mount pages from `src/pages`. Reusable controls live in `src/components`. Query keys and invalidation live under `src/queries`, so pages do not hardcode cache structure.

The markdown editor is Tiptap-based. Markdown is converted to HTML for editing and serialized back to markdown on editor updates. The image button opens the media picker and inserts the selected media URL into the document.
