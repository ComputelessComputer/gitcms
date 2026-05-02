# Author Context — the writing brief

gitcms can serve a "writing brief" — a long-form description of your brand, audience, and voice — to anyone (or any AI agent) authoring content. Authors and agents read it before they write, so output stays on-brand without you re-explaining tone in every prompt.

The brief is plain markdown that lives in your content repo. There is no UI to "configure" it — you commit the files, gitcms reads them back.

## Files

```
content/                            # your <content.path>
├── .gitcms/
│   ├── context.md                  # company / brand / audience
│   └── voice.md                    # tone / style / voice
├── blog/
│   ├── .gitcms/
│   │   └── voice.md                # blog-specific voice override (optional)
│   └── hello-world.md
└── docs/
    ├── .gitcms/
    │   └── voice.md                # docs-specific voice override (optional)
    └── intro.md
```

| File                                      | What goes in it                                                        |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `<content>/.gitcms/context.md`            | Who the company is, what it sells, who reads the content.              |
| `<content>/.gitcms/voice.md`              | Tone, style rules, banned words, examples of "yes" and "no" sentences. |
| `<content>/<collection>/.gitcms/voice.md` | Optional voice override scoped to one collection (blog vs docs).       |

All three files are independent — you can ship just `context.md`, just `voice.md`, or all three. Missing files are fine. Empty files are treated as missing.

## What "merged" means

When something asks for the brief — the editor UI, an AI agent via `GET /api/context` — gitcms returns each file individually and a `merged` field that stitches them together in this order:

1. `context.md` (repo)
2. `voice.md` (repo)
3. `voice.md` (collection, if a collection was specified)

Section headers are inserted between non-empty parts so the consumer can tell which override is which:

```markdown
# Brand & audience context

Acme is a B2B fintech serving mid-market CFOs...

# Voice & style

Plainspoken. Sentences under 25 words. Never use "leverage" as a verb...

# Voice & style — Blog

Blog posts can be more conversational. First-person plural ("we") is fine...
```

Drop `merged` directly into an agent's system prompt. The structure is intentionally LLM-friendly.

## How agents fetch the brief

```
GET /api/context                   # repo-level only
GET /api/context?collection=blog   # repo-level + blog override
GET /api/context?branch=drafts     # read from a non-default branch
```

The response is JSON:

```json
{
  "context": "Acme is a B2B fintech...",
  "voice": "Plainspoken...",
  "collectionVoice": null,
  "merged": "# Brand & audience context\n\nAcme..."
}
```

## Public vs authenticated

`GITCMS_CONTEXT_PUBLIC=true` (the default) makes `GET /api/context` work for unauthenticated callers. The server uses your configured `GITCMS_GITHUB_SERVICE_TOKEN` to read the underlying files.

| `GITCMS_CONTEXT_PUBLIC` | `GITCMS_GITHUB_SERVICE_TOKEN` | Behavior                                                                  |
| ----------------------- | ----------------------------- | ------------------------------------------------------------------------- |
| `true` (default)        | Set                           | Anyone can `GET /api/context`. Reads use the service token.               |
| `true`                  | Unset                         | Falls back to authenticated mode — only signed-in members get a response. |
| `false`                 | Either                        | Members only. Same gate as the rest of the gitcms API.                    |

Public-by-default is the right call for most setups: brand voice docs are not strategic secrets, and frictionless agent access is the whole point. Flip to `false` if your brief contains things you don't want public.

## A starter template

If you have nothing yet, this is a reasonable shape:

`content/.gitcms/context.md`:

```markdown
# About Acme

Acme is a B2B accounts-payable automation tool for mid-market companies (50-500 employees). Customers are CFOs and finance ops leads. They are not technical and they hate marketing fluff.

## What we sell

A web app that connects to a company's bank, captures invoices from email, and pushes payments. Pricing is per-seat with a free tier under 10 invoices/month.

## Who reads our content

Finance leads who Google specific problems ("how do I reconcile a wire that bounced?"). They want a 2-minute answer, not a 15-minute thought-piece.
```

`content/.gitcms/voice.md`:

```markdown
# Voice

- Plain. Concrete. Specific. No business-speak.
- Sentences under 25 words. Most under 15.
- Lead with the answer, then explain.
- No emoji in headlines. Sparingly in body.
- Never say "leverage", "synergy", "drive impact", "thought leader".
- Always say "you" not "users". Always say "Acme" not "the platform".

## Examples

Yes: "If a wire bounces, the funds return in 1–3 business days."
No: "In the unfortunate event of a wire reversal, customers can typically expect..."

Yes: "Connect your bank in two clicks."
No: "Acme provides seamless integration with your financial institution."
```

## Editing the brief

It's just markdown. Edit it like any other content file:

- Through the gitcms editor UI (when the writing-brief panel ships in a future PR)
- Directly in your editor — open `content/.gitcms/context.md` and commit
- Through a PR review process — the brief is versioned with content, so changes to brand voice show up in git history with attribution

## Why "context as content"

Most CMSes treat editorial guidelines as separate metadata — locked behind admin UIs, edited by one role, invisible to authors and agents. gitcms makes the brief a _file in the content repo_ on purpose:

- It's reviewable. Voice changes go through PRs like any other content change.
- It's reproducible. The brief at any point in git history is the brief that produced the content at that point.
- It's portable. Move repos and the brief moves with the content.
- It's agent-readable. Any agent with read access to your repo can self-serve the brief — no API key, no special endpoint to discover.

## Limits and trade-offs

- **No structured fields.** The brief is prose. If you want banned-words enforcement at save time, that's a future feature, not what this is.
- **Public by default.** If `context.md` contains things you'd be embarrassed to have an outsider read, set `GITCMS_CONTEXT_PUBLIC=false`.
- **No per-author voice.** A single repo gets a single brief tree. If different authors should write differently, that's a team-handbook problem, not a gitcms problem.
- **No prompt-engineering DSL.** Don't write `{{persona: "skeptical CFO"}}` template variables. Just write good prose. Agents handle prose.
