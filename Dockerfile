# Builds and runs only the persistent worker (daemon/) — the one piece of
# this project that can't be serverless (see daemon/src/env.ts's comment):
# AgentRunner does real file edits + git commits, which need a real
# writable filesystem and a git binary, not a Netlify Function. Everything
# else (the API, Nova's periodic reasoning) lives on Netlify instead.
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/package.json
COPY daemon/package.json daemon/package.json
RUN npm ci --workspace shared --workspace daemon --include-workspace-root

COPY shared shared
COPY daemon daemon
RUN npm run build --workspace shared && npm run build --workspace daemon

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production

# Node 22+ specifically: @supabase/supabase-js's realtime client checks for
# the native global WebSocket even to construct the client (this worker
# never subscribes to Realtime, but createClient() still runs that check
# unconditionally) — Node 20 doesn't have it and every db() call throws
# "Node.js detected but native WebSocket not found."
#
# gitModule.ts shells out to the real `git` binary (single-committer
# pattern — see its own comment) to commit each employee's work.
RUN apt-get update \
  && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/node_modules node_modules
COPY --from=build /app/shared/dist shared/dist
COPY --from=build /app/shared/package.json shared/package.json
COPY --from=build /app/daemon/dist daemon/dist
COPY --from=build /app/daemon/package.json daemon/package.json
COPY package.json package.json

CMD ["node", "daemon/dist/index.js"]
