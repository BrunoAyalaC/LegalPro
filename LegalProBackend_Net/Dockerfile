# LegalProBackend_Net/Dockerfile
# Generado por @devops
# .NET 8 backend con multi-stage build

# Stage 1: Build
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy csproj and restore
COPY ["LegalPro.Api/LegalPro.Api.csproj", "LegalPro.Api/"]
COPY ["LegalPro.Application/LegalPro.Application.csproj", "LegalPro.Application/"]
COPY ["LegalPro.Domain/LegalPro.Domain.csproj", "LegalPro.Domain/"]
COPY ["LegalPro.Infrastructure/LegalPro.Infrastructure.csproj", "LegalPro.Infrastructure/"]
RUN dotnet restore "LegalPro.Api/LegalPro.Api.csproj"

# Copy everything else and build
COPY . .
WORKDIR /src/LegalPro.Api
RUN dotnet publish -c Release -o /app/publish --no-restore

# Stage 2: Production
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS production
LABEL maintainer="LegalPro DevOps <devops@legalpro.pe>"
ARG APP_VERSION=6.12.0
LABEL version="${APP_VERSION}"

ENV ASPNETCORE_URLS=http://+:5000
ENV ASPNETCORE_ENVIRONMENT=Production
ENV DOTNET_RUNNING_IN_CONTAINER=true
ENV DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

WORKDIR /app
COPY --from=build /app/publish .

# Instalar curl para el HEALTHCHECK (la imagen mcr.microsoft.com/dotnet/aspnet NO lo incluye).
# Se instala como root ANTES de cambiar a USER app (apt-get requiere root).
RUN apt-get update && apt-get install -y curl --no-install-recommends && rm -rf /var/lib/apt/lists/*

# Security: run as non-root (usuario 'app' ya existe en aspnet:8.0)
RUN chown -R app:app /app
USER app

# Health check — Kestrel escucha en el puerto definido por la env var PORT
# (Program.cs usa builder.WebHost.UseUrls($"http://*:{port}") con PORT o default 5000).
# ${PORT} se resuelve en runtime desde la env var inyectada por Railway (8080 en producción).
# Fallback a 5000 (default de Program.cs / ASPNETCORE_URLS) si PORT no está definido.
HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD curl -f "http://localhost:${PORT:-5000}/health/live" || exit 1

EXPOSE 5000
ENTRYPOINT ["dotnet", "LegalPro.Api.dll"]
