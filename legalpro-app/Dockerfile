# legalpro-app/Dockerfile
# Node.js backend con multi-stage build
#
# CONTEXTO DE BUILD: legalpro-app/ (rootDirectory del servicio Railway).
# Este Dockerfile es AUTOCONTENIDO: asume que catalogs/ y tools/ viven
# DENTRO de legalpro-app/ (espejo sincronizado de la raíz del repo).
#
# Build local (desde legalpro-app/):
#   docker build -t legalpro-node .
# Build desde raíz:
#   docker build -t legalpro-node -f legalpro-app/Dockerfile legalpro-app/
#
# SYNC (una vez por cambio de catálogos/tools, desde la raíz):
#   robocopy catalogs legalpro-app\catalogs /MIR
#   robocopy tools     legalpro-app\tools     /MIR

FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm install --only=production --no-audit --no-fund --legacy-peer-deps

FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY server ./server
COPY catalogs ./catalogs
COPY tools ./tools

FROM node:20-alpine AS production
LABEL maintainer="LegalPro DevOps <devops@legalpro.pe>"
LABEL org.opencontainers.image.source="https://github.com/brunoayalac/abogacia"

ENV NODE_ENV=production
ENV PORT=3001
ENV NODE_OPTIONS="--max-old-space-size=512"
# Chromium para generación de PDF (puppeteer v24)
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
ENV PUPPETEER_SKIP_DOWNLOAD=true

# Instalar Chromium y dependencias del sistema para puppeteer en Alpine
RUN apk add --no-cache \
      chromium \
      nss \
      freetype \
      harfbuzz \
      ca-certificates \
      ttf-freefont \
      font-noto-cjk \
      fontconfig \
      && addgroup -g 1001 -S nodejs \
      && adduser -S nodejs -u 1001

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/package.json ./
# ── Rutas canónicas de catálogos/tools (CONVENCIÓN ÚNICA) ─────────────────────
# El código usa rutas relativas a la RAÍZ del repo: desde /app/server/xxx/,
# ../../../catalogs = /catalogs y ../../../tools/rag = /tools/rag.
# - catalogs → /catalogs (JSON, sin packages; viene del contexto legalpro-app/)
# - tools    → /app/tools (DENTRO de /app para resolver node_modules/pg) y
#   symlink /tools -> /app/tools para que ../../../tools resuelva.
COPY --from=build /app/catalogs /catalogs
COPY --from=build /app/tools /app/tools
RUN ln -sfn /app/tools /tools \
    && chown -R nodejs:nodejs /app /catalogs /tools

USER nodejs

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

EXPOSE 3001
CMD ["node", "server/index.js"]
