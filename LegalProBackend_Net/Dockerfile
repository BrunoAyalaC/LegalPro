# Etapa de construcción (Build)
FROM mcr.microsoft.com/dotnet/sdk:9.0-alpine AS build
WORKDIR /src

# Copiar archivos csproj y restaurar dependencias
COPY ["LegalPro.Api/LegalPro.Api.csproj", "LegalPro.Api/"]
COPY ["LegalPro.Application/LegalPro.Application.csproj", "LegalPro.Application/"]
COPY ["LegalPro.Domain/LegalPro.Domain.csproj", "LegalPro.Domain/"]
COPY ["LegalPro.Infrastructure/LegalPro.Infrastructure.csproj", "LegalPro.Infrastructure/"]
RUN dotnet restore "LegalPro.Api/LegalPro.Api.csproj"

# Copiar todo el código fuente y compilar
COPY . .
WORKDIR "/src/LegalPro.Api"
RUN dotnet build "LegalPro.Api.csproj" -c Release -o /app/build

# Etapa de publicación (Publish)
FROM build AS publish
RUN dotnet publish "LegalPro.Api.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Etapa final (Runtime)
FROM mcr.microsoft.com/dotnet/aspnet:9.0-alpine AS final
WORKDIR /app
EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080

COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "LegalPro.Api.dll"]
