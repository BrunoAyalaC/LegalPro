# Skill: Deploy Backend a Railway

## Cuándo usar

Cuando necesites desplegar los backends de LegalPro a Railway (producción).

## Backend Node (Express 5)

### Railway auto-detecta Node.js

```bash
# 1. Login y vincular proyecto
railway login
railway link

# 2. Deploy
railway up

# 3. O via GitHub (auto-deploy en push a main)
```

### package.json requerido

```json
{
  "scripts": {
    "start": "node server/index.js",
    "dev": "node --watch server/index.js"
  },
  "engines": { "node": ">=20" }
}
```

### Variables de Entorno (Railway Dashboard)

```env
PORT=3000
NODE_ENV=production
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_KEY=eyJ...
GEMINI_API_KEY=AIza...
JWT_SECRET=super-secret-256-bits
```

### server/index.js debe usar PORT

```javascript
const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => console.log(`Server on port ${PORT}`));
```

## Backend .NET (ASP.NET Core 8)

### Dockerfile multi-stage

```dockerfile
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["LegalPro.Api/LegalPro.Api.csproj", "LegalPro.Api/"]
COPY ["LegalPro.Application/LegalPro.Application.csproj", "LegalPro.Application/"]
COPY ["LegalPro.Domain/LegalPro.Domain.csproj", "LegalPro.Domain/"]
COPY ["LegalPro.Infrastructure/LegalPro.Infrastructure.csproj", "LegalPro.Infrastructure/"]
RUN dotnet restore "LegalPro.Api/LegalPro.Api.csproj"
COPY . .
RUN dotnet publish "LegalPro.Api/LegalPro.Api.csproj" -c Release -o /app/publish

FROM base AS final
WORKDIR /app
COPY --from=build /app/publish .
HEALTHCHECK CMD curl -f http://localhost:8080/health || exit 1
ENTRYPOINT ["dotnet", "LegalPro.Api.dll"]
```

### Variables de Entorno (Railway)

```env
ASPNETCORE_ENVIRONMENT=Production
ASPNETCORE_URLS=http://+:8080
ConnectionStrings__DefaultConnection=Host=db.xxx.supabase.co;Port=5432;Database=postgres;Username=postgres;Password=xxx;SSL Mode=Require;Trust Server Certificate=True
Jwt__Secret=same-jwt-secret
Gemini__ApiKey=AIza...
```

## Checklist Pre-Deploy

- [ ] Variables de entorno configuradas en Railway Dashboard
- [ ] SUPABASE_URL y keys correctos
- [ ] GEMINI_API_KEY configurada
- [ ] Puerto correcto (Node: PORT env, .NET: 8080)
- [ ] Health check endpoint disponible
- [ ] CORS configurado para Android app
- [ ] Logs verificados post-deploy
