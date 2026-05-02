# AGENTS-USING-GITCMS.md

You're an AI agent (Claude Code, Codex, Cursor, Copilot, a custom agent built on the OpenAI/Anthropic API, etc.) and you've been pointed at a gitcms instance to author content. This doc tells you how to do that without breaking anything.

> **Looking to contribute to the gitcms codebase itself?** Read [`AGENTS.md`](../AGENTS.md) at the repo root instead.

## What gitcms is, in one paragraph

gitcms is a CMS where the database is a GitHub repo and the content is plain markdown. Every "save" is a git commit. Every "publish" can either commit directly to the main branch or open a pull request. There is no separate database — if you can read the repo, you have the full content history.

This is good for agents because:

- You can author markdown directly. No proprietary block format.
- You can read the writing brief (voice, tone, banned words, brand context) from the same repo before drafting.
- You can either go through the gitcms HTTP API (with a token) or commit directly to the repo if you have write access.

## Two ways to write content

| Mode                          | When to use                                                                  | What you need                                               |
| ----------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **A. Through the gitcms API** | The user is using a gitcms instance and wants you to use the same auth path. | The gitcms base URL + a session cookie or JWT.              |
| **B. Direct git commits**     | You have a GitHub PAT and just want to commit markdown.                      | Repo write access, the content path conventions (this doc). |

Mode B is simpler. Mode A gives you frontmatter validation, working branches, and PR creation for free. Pick based on what the user gives you.

---

## Mode A: through the gitcms API

The API is a set of typed server functions (TanStack Start) plus a couple of raw HTTP endpoints for blob upload. All mutating endpoints require admin auth.

### Authenticating

Two flavors:

#### A1. GitHub OAuth (browser-driven)

Default mode. Sign in via `/auth/signin`, get a session cookie. Most agents won't go this route — it requires a browser flow.

#### A2. JWT bearer (build-pipeline / programmatic)

When the gitcms instance is configured with `GITCMS_AUTH_MODE=jwt`, the agent gets a JWT from the user's identity provider (Clerk, WorkOS, Auth0, Supabase Auth, or a self-issued one) and passes it as `Authorization: Bearer <jwt>`. The server validates it against the JWKS URL configured in `GITCMS_AUTH_JWT_JWKS_URL`.

Ask the user for:

- The gitcms base URL (e.g. `https://cms.acme.com`)
- A JWT (or how to mint one)

### Endpoints (server functions, JSON-RPC-ish)

Server functions are POST endpoints under `/_server/`. Inputs are validated by zod, errors come back as `{ error: string }` with a 4xx/5xx status.

#### `contentList`

```
POST /_server/contentList
Body: { "collectionId": "blog" }
Returns: { items: [{ slug, path, frontmatter, ... }, ...] }
```

#### `contentRead`

```
POST /_server/contentRead
Body: { "collectionId": "blog", "path": "blog/hello-world.md", "branch": "main" }
Returns: { frontmatter, body, sha, branch }
```

#### `contentSave`

```
POST /_server/contentSave
Body: {
  "collectionId": "blog",
  "slug": "hello-world",
  "frontmatter": { "title": "...", "date": "...", "draft": false, ... },
  "body": "# Hello\n\nMarkdown content here.",
  "commitMessage": "post: add hello-world",
  "directCommit": false        // false = commits to a working branch (default), true = commits straight to main
}
Returns: { branch, sha, path }
```

#### `contentRename` / `contentDelete` / `contentCreateBranch` / `contentOpenPR`

Same pattern — see `src/server/fn/content.ts` for exact input shapes.

#### `mediaList`

```
POST /_server/mediaList
Body: { "prefix": "uploads/" }
Returns: { items: [{ key, url, size, ... }, ...] }
```

#### Media upload (raw HTTP)

```
POST /api/media/upload
Headers: Cookie or Authorization: Bearer <jwt>
Body: multipart/form-data with `file` field, optional `key` field
Returns: { key, url }
```

### Typical agent flow

```text
1. GET /api/context?collection=blog       # read the writing brief (see "Author Context" below)
2. Draft markdown body + frontmatter      # follow the brief
3. POST /_server/contentSave              # save to a working branch
4. POST /_server/contentOpenPR            # open a PR for human review
5. Done — link the PR back to the user
```

For drafts the agent is confident in (or for agents acting as the user themselves), set `directCommit: true` and skip step 4.

---

## Mode B: direct git commits

If the user gives you a GitHub PAT and tells you "just write to the repo," do this:

### 1. Read `gitcms.config.ts` from the repo root

It declares the content path and collections:

```ts
export default defineConfig({
  content: {
    repo: "alice/my-blog",
    branch: "main",
    path: "content",
    workingBranchPrefix: "gitcms/",
  },
  collections: [
    { id: "blog", path: "blog", bodyFormat: "markdown", schema: { ... } },
  ],
});
```

### 2. Compute the file path

```
{content.path}/{collection.path}/{slug}.md
```

For the example above, a post with slug `hello-world` lives at `content/blog/hello-world.md`.

### 3. Validate the frontmatter against the collection schema

Field types: `string`, `date`, `boolean`, `string-array`, `number`. Required fields must be present. See `src/config.ts` for the exact zod schema.

### 4. Write markdown with YAML frontmatter

```markdown
---
title: Hello World
date: 2025-01-15
tags: [welcome, intro]
draft: false
---

# Hello

Body content here. Standard CommonMark.
```

Date format: `YYYY-MM-DD` for `date` fields. ISO 8601 is also accepted.

### 5. Commit

Use a clear message — `post: add <slug>` for new content, `post: update <slug>` for edits. Commit directly to `main` or open a PR. For PRs, branch from `main` and name the branch `{workingBranchPrefix}{slug}` (e.g. `gitcms/hello-world`).

Add a co-author trailer if you're committing on behalf of a human:

```
post: add hello-world

Co-authored-by: Alice <alice@example.com>
```

---

## Author Context: read the brief before you write

A gitcms content repo can include a writing brief that tells you (the agent) how to write. It lives in the content repo at:

```
content/
  .gitcms/
    context.md           # who the company is, what they sell, the audience
    voice.md             # tone, style rules, banned words, examples
  blog/
    .gitcms/
      voice.md           # blog-specific overrides (optional)
    hello-world.md
```

### How to consume it

**Mode A (API):**

```
GET /api/context?collection=blog
Returns: { context: "...", voice: "...", merged: "..." }
```

The `merged` field is the flattened brief: repo-level `context.md` + repo-level `voice.md` + collection-level `voice.md`, in that order. Drop it directly into your system prompt.

**Mode B (direct git):**

Read these files from the content repo directly:

```
content/.gitcms/context.md
content/.gitcms/voice.md
content/{collection.path}/.gitcms/voice.md   # optional, overrides repo-level voice
```

Concat them yourself — repo `context.md`, then repo `voice.md`, then collection `voice.md`.

### Always read the brief first

If a writing brief exists, **read it before drafting**. The user has put it there for a reason. Banned words, tone, brand voice — these are not optional preferences, they're the rules.

If no brief exists, the user is probably fine with sensible defaults. Use clean prose, `## H2` headings, no emoji unless the topic warrants, no marketing fluff.

---

## Frontmatter schema reference

Every collection declares a frontmatter schema. Common shape:

```ts
schema: {
  title:  { type: "string",       required: true },
  date:   { type: "date",         required: true },
  tags:   { type: "string-array" },
  draft:  { type: "boolean",      default: false },
  order:  { type: "number" },
}
```

| Type           | Example value    | Notes                        |
| -------------- | ---------------- | ---------------------------- |
| `string`       | `"Hello"`        | Plain string.                |
| `date`         | `2025-01-15`     | YAML date or ISO 8601.       |
| `boolean`      | `true` / `false` |                              |
| `string-array` | `[a, b, c]`      | YAML flow or block sequence. |
| `number`       | `42`             |                              |

Fields with `required: true` must be present and non-empty. Fields with `default: ...` will be auto-filled if omitted (Mode A only — Mode B requires you to write them yourself).

## Slugs

Slugs are derived from the article title in Mode A (kebab-case, ASCII-only, deduplicated). In Mode B you compute them yourself: lowercase, hyphenated, no special characters. The file basename is the slug.

## Media

In Mode A, upload via `POST /api/media/upload` and reference the returned URL in the markdown.

In Mode B, the convention is collection-relative for tightly-coupled assets:

```
content/blog/hello-world/cover.png
content/blog/hello-world.md
```

Or use the storage backend directly if you have credentials for it. gitcms supports Supabase, S3-compatible (R2, B2, MinIO), GitHub itself, and local disk — but as an external agent you usually only have repo access, so committing media into the content repo is the simplest path.

## Common recipes

### "Publish a draft post"

```
1. GET /api/context?collection=blog                                    # read brief
2. Draft frontmatter + body following the brief
3. POST /_server/contentSave with directCommit=false                   # working branch
4. POST /_server/contentOpenPR                                         # human reviews
```

### "Bulk import N markdown files"

Mode B is best. Loop over files, write each to `content/{collection}/{slug}.md`, commit in one batch (or one commit per post — whichever the user prefers).

### "Update an existing post"

```
1. POST /_server/contentRead   { collectionId, path }
2. Modify frontmatter and/or body
3. POST /_server/contentSave   { collectionId, slug, frontmatter, body, commitMessage, directCommit: false }
```

If `directCommit: false` (the default), the change goes to the working branch `gitcms/{slug}`. Open a PR with `contentOpenPR`.

### "Just give me the writing brief"

```
GET /api/context?collection=<id>
```

Or if no collection is given, returns just the repo-level context+voice merge.

## What NOT to do as an agent

- **Don't invent frontmatter fields.** Only use fields declared in the collection schema. Extra fields will fail validation.
- **Don't commit binary blobs to the content repo without a reason.** Use the storage backend or the dedicated media path.
- **Don't bypass the working branch** unless you (or the user) really mean direct-publish. PRs exist for human review of agent output.
- **Don't write to `.gitcms/` config files** unless the user explicitly asks. Those are operator config, not content.
- **Don't make up the gitcms API surface.** This file is the contract. If you need an endpoint that isn't here, say "I'd need an endpoint for X" — don't guess.
- **Don't ignore the writing brief.** If `content/.gitcms/context.md` exists, read it. This is the single most important rule.

## Errors

| Status | Meaning                                                                                     |
| ------ | ------------------------------------------------------------------------------------------- |
| 401    | Not authenticated. Get a session cookie or JWT.                                             |
| 403    | Authenticated but not an allowed member. The operator needs to add you to `GITCMS_MEMBERS`. |
| 422    | Frontmatter or body failed validation. Read the error message; fix and retry.               |
| 409    | Branch already exists, or slug already taken. Pick a new slug or use the existing branch.   |
| 5xx    | Server problem. Don't retry-loop; surface the error to the user.                            |

## Versioning

This doc tracks gitcms `0.0.x`. Anything marked "roadmap" may not be shipped yet. Check the gitcms repo CHANGELOG (when it exists) for what's actually live in your target instance.
