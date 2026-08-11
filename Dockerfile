# Pinned: Node 24.19.0 added cleanup hooks to node::ObjectWrap, which makes
# better-sqlite3 abort on `CHECK_NOT_NULL(env)` when a Statement is garbage
# collected with no entered V8 context. See nodejs/node#63985 for the fix;
# unpin once it ships in a 24.x release.
FROM node:24.18.1-bookworm-slim AS builder
WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json

RUN npm ci

COPY . .

RUN npm run format:check \
  && npm run lint \
  && npm run build

# Drop dev dependencies so only what the runtime needs is carried forward.
RUN npm prune --omit=dev

FROM node:24.18.1-bookworm-slim AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    HOST=127.0.0.1 \
    DB_PATH=/app/data/myholdings.db

RUN apt-get update \
  && apt-get install -y --no-install-recommends nginx \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/data /tmp/nginx \
  && chown -R node:node /app /tmp/nginx /var/lib/nginx /var/log/nginx

COPY --from=builder --chown=node:node /app/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/apps/api/dist ./apps/api/dist
COPY --from=builder --chown=node:node /app/apps/api/drizzle ./apps/api/drizzle
COPY --from=builder --chown=node:node /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder --chown=node:node /app/apps/web/dist /usr/share/nginx/html

COPY nginx.conf /etc/nginx/nginx.conf
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

USER node

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
