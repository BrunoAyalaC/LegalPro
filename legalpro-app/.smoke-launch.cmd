@echo off
setlocal
cd /d "C:\Users\Pc\Desktop\Abogacia\legalpro-app"

REM 64-char dev secret. Alphanumeric only to dodge any shell quoting weirdness.
set "JWT_SECRET=SmokeTestJWTSecretMustBeAtLeast32CharactersLong_OK"

set "DATABASE_URL=postgresql://postgres:***@127.0.0.1:5432/legalpro"
set "SUPABASE_URL=https://example.supabase.co"
set "SUPABASE_ANON_KEY=smoke-anon-key"
set "SUPABASE_SERVICE_KEY=smoke-service-key"
set "SUPABASE_STORAGE_BUCKET_EVIDENCIA=evidencia"
set "PORT=3055"
set "NODE_ENV=development"
set "PGSSLMODE=disable"

REM Debug: confirm secret is what we expect.
echo JWT_SECRET starts with: %JWT_SECRET:~0,15%... (len=%JWT_SECRET:~0,1%? use next line)
echo JWT_SECRET length:
powershell -NoProfile -Command "(Get-ChildItem Env:JWT_SECRET).Value.Length"

node server/index.js