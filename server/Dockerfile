# syntax=docker/dockerfile:1

ARG NODE_VERSION=24.19.0
ARG NPM_VERSION=11.17.0

# ---- base: pinned Node and npm, used by the build stages ------------------
FROM node:${NODE_VERSION}-alpine AS base
ARG NPM_VERSION
RUN npm install -g npm@${NPM_VERSION}
WORKDIR /app

# ---- deps: ALL dependencies (needed to build and to run migrations) -------
FROM base AS deps
# The Prisma CLI needs OpenSSL on Alpine.
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

# ---- build: generate the Prisma client, compile TypeScript ----------------
FROM deps AS build
COPY . .
# prisma.config.ts requires DATABASE_URL to exist. This is a dummy value:
# nothing connects during `generate`, and it is not kept in the final image.
RUN DATABASE_URL=postgresql://build:build@localhost:5432/build npx prisma generate
RUN npm run build

# ---- prod-deps: runtime dependencies only (no dev tools, smaller image) ---
FROM base AS prod-deps
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci --omit=dev

# ---- migrate: one-shot job that applies database migrations ---------------
FROM deps AS migrate
COPY prisma ./prisma
COPY prisma.config.ts ./
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# ---- runtime: the image you deploy ----------------------------------------
FROM node:${NODE_VERSION}-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# tini is a tiny init process: it forwards SIGTERM to Node (so your graceful
# shutdown runs) and cleans up zombie processes.
RUN apk add --no-cache tini

COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build     --chown=node:node /app/dist ./dist
COPY --from=build     --chown=node:node /app/generated ./generated
COPY --chown=node:node package.json ./
# Never run as root.
USER node
EXPOSE 5001

# Alpine has no curl, so use Node itself for the check.
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:5001/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/server.js"]