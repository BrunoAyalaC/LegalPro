# ── Build stage ────────────────────────────────────────────────
FROM node:20-alpine AS deps
WORKDIR /app

# Parchear CVE-2026-22184 (zlib HIGH) en Alpine base
RUN apk upgrade --no-cache

# Solo package files primero (cache de dependencias)
COPY package*.json ./
RUN npm ci --only=production --ignore-scripts

# ── Runtime stage ──────────────────────────────────────────────
FROM node:20-alpine AS final
WORKDIR /app

# Parchear CVE-2026-22184 (zlib HIGH) y actualizar npm
# para corregir cross-spawn CVE-2024-21538 (ReDoS) en npm interno
RUN apk upgrade --no-cache && npm install -g npm@latest --ignore-scripts

ENV NODE_ENV=production
ENV PORT=3001

# Usuario no-root por seguridad
RUN addgroup -g 1001 -S nodejs && adduser -S legalpro -u 1001

# Copiar dependencias y código del servidor
COPY --from=deps /app/node_modules ./node_modules
COPY server/ ./server/
COPY package.json ./

USER legalpro

EXPOSE 3001

# Health check para Railway
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

CMD ["node", "server/index.js"]
