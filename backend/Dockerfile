# ---------- deps: solo dependencias de producción ----------
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- runtime ----------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production
WORKDIR /app

# postgresql17-client: pg_dump para los respaldos desde la sección Soporte
RUN apk add --no-cache tini postgresql17-client \
  && mkdir -p /app/uploads /app/backups \
  && chown node:node /app/uploads /app/backups

# Versión visible en Soporte → Estado (GIT_SHA se pasa al construir; la fecha es automática)
ARG GIT_SHA=""
ENV APP_VERSION=$GIT_SHA
RUN date -u +%Y-%m-%dT%H:%M:%SZ > /app/BUILD_DATE

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node migrations ./migrations

USER node
EXPOSE 4000

HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "src/server.js"]
