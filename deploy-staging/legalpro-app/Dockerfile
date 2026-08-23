# legalpro-app/Dockerfile
# Node.js backend con multi-stage build
# Build: docker build -t legalpro-node -f legalpro-app/Dockerfile .

FROM node:20-alpine AS deps
WORKDIR /app
COPY legalpro-app/package*.json ./
RUN npm install --only=production --no-audit --no-fund --legacy-peer-deps

FROM node:20-alpine AS build
WORKDIR /app
COPY legalpro-app/package*.json ./
RUN npm install --no-audit --no-fund --legacy-peer-deps
COPY legalpro-app/ .

FROM node:20-alpine AS production
LABEL maintainer="LegalPro DevOps <devops@legalpro.pe>"

ENV NODE_ENV=production
ENV PORT=3001
ENV NODE_OPTIONS="--max-old-space-size=512"

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/server ./server
COPY --from=build /app/package.json ./
COPY catalogs ./catalogs

RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3001/health || exit 1

EXPOSE 3001
CMD ["node", "server/index.js"]
