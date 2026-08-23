# legalpro-owner-dashboard/Dockerfile
# Generado por @devops + @owner-admin
# Owner dashboard con multi-stage

# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci --no-audit --no-fund
COPY . .

# Stage 2: Production
FROM node:20-alpine AS production
LABEL maintainer="LegalPro DevOps <devops@legalpro.pe>"
LABEL version="1.0.0"

ENV NODE_ENV=production
ENV PORT=3005

WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/server.js ./
COPY --from=build /app/public ./public
COPY --from=build /app/package.json ./

# Security: run as non-root
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001
RUN chown -R nodejs:nodejs /app
USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:3005/health || exit 1

EXPOSE 3005
CMD ["node", "server.js"]
