# GitHub Copilot instructions

This project's full agent guide lives in [`AGENTS.md`](../AGENTS.md) at the repo root. Read that file before making suggestions.

Quick rules for any change in this repo:

- Use pnpm (10.33+), not npm or yarn.
- No `useEffect()`. The eslint config bans it via `no-restricted-syntax`. Prefer derived state, event handlers, React Query, or `useMountEffect`.
- No `any`. No floating promises. Both are eslint errors.
- Server-side mutations go through `requireAdminServerFn()` — never read cookies directly.
- Env vars: schema in `src/env.ts`, value via `getEnv()`. Never `process.env` outside `src/env.ts`.
- New auth providers, storage backends, server functions: see "Adding things" in `AGENTS.md`.
- Tests mirror `src/` paths. Vitest, not jest.

For the full conventions, landmines, and architecture, read `AGENTS.md`.
