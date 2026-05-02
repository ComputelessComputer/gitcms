FROM node:22-bookworm-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN corepack enable

FROM base AS deps
COPY package.json ./
RUN pnpm install --frozen-lockfile=false

FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runner
ENV NODE_ENV=production
ENV PORT=3000
WORKDIR /app
COPY --from=build /app/.output ./.output
COPY --from=build /app/package.json ./package.json
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
