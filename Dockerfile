# Node major: keep in sync with CI (node-version in .github/workflows/ci.yml)
# and @types/node (see the TODO in .github/dependabot.yml).
FROM node:24-alpine AS service-deps

USER node

RUN mkdir -p /home/node/monorepo
WORKDIR /home/node/monorepo

COPY --chown=node package*.json ./
COPY --chown=node packages/service/package*.json ./packages/service/

RUN npm ci --workspace @meter-app/service --include-workspace-root=false

FROM node:24-alpine AS service-prod-deps

USER node

RUN mkdir -p /home/node/monorepo
WORKDIR /home/node/monorepo

COPY --chown=node package*.json ./
COPY --chown=node packages/service/package*.json ./packages/service/

# npm nests packages whose version differs from the root copy under packages/service/node_modules;
# create the folder so the runner stage can always copy it, even when nothing is nested.
RUN npm ci --omit=dev --omit=optional --workspace @meter-app/service --include-workspace-root=false \
  && mkdir -p packages/service/node_modules

FROM service-deps AS service-builder

WORKDIR /home/node/monorepo/packages/service
ARG DATABASE_URL=postgres://postgres:postgres@db:5432/postgres
ENV DATABASE_URL=${DATABASE_URL}
COPY --chown=node packages/service/ ./
RUN npm run prisma:generate && npm run build

FROM service-prod-deps AS service-runtime-deps

COPY --from=service-builder /home/node/monorepo/node_modules/@prisma/client /home/node/monorepo/node_modules/@prisma/client
COPY --from=service-builder /home/node/monorepo/node_modules/.prisma /home/node/monorepo/node_modules/.prisma

FROM node:24-alpine AS service-runner

USER node
# Keep the workspace layout: Node resolves the service's nested packages from
# packages/service/node_modules first and falls back to the root node_modules.
WORKDIR /app/packages/service

COPY --from=service-deps /home/node/monorepo/packages/service/package.json ./
COPY --from=service-runtime-deps /home/node/monorepo/node_modules/ /app/node_modules/
COPY --from=service-runtime-deps /home/node/monorepo/packages/service/node_modules/ ./node_modules/
COPY --from=service-builder /home/node/monorepo/packages/service/dist ./dist
COPY --from=service-builder /home/node/monorepo/packages/service/prisma ./prisma

ENV HOST=0.0.0.0 PORT=3002
EXPOSE ${PORT}

CMD ["node", "dist/main.js"]

FROM node:24-alpine AS web-deps

USER node

RUN mkdir -p /home/node/monorepo
WORKDIR /home/node/monorepo

COPY --chown=node package*.json ./
COPY --chown=node packages/web/package*.json ./packages/web/

RUN npm ci --workspace @meter-app/web --include-workspace-root=false

FROM web-deps AS web-builder

WORKDIR /home/node/monorepo/packages/web
COPY --chown=node packages/web/ ./
RUN npm run build

FROM nginx:alpine AS web-runner

COPY --from=web-builder /home/node/monorepo/packages/web/dist /usr/share/nginx/html
COPY docker/nginx/web.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
