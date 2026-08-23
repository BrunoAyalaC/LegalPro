# 💾 Backup & Disaster Recovery — LegalPro

> Procedimiento completo de backup, verificación y restauración.

---

## 📋 Estado actual

| Componente | Estado | Evidencia |
|---|---|---|
| Script de backup | ✅ Existe | `tools/backup/backup.sh` |
| Script de restore | ✅ Creado 2026-06-27 | `tools/backup/restore.sh` |
| Backup automatizado diario | ❌ NO configurado | Pendiente cron en Railway |
| Verificación de integridad | ❌ NO automatizado | Pendiente |
| Restauración probada en frío | ❌ NO probada | Crítico hacerlo antes de producción |
| Backup off-site (S3) | ❌ NO configurado | Requiere AWS credentials |

---

## 🚀 Cómo hacer backup manual ahora

### Opción A: Backup local con docker-compose (dev)

```bash
# 1. Levantar postgres si no está corriendo
docker compose up -d postgres

# 2. Backup
docker exec legalpro-postgres pg_dump \
  -U legalpro -d legalpro \
  --no-owner --no-privileges --format=custom --compress=9 \
  > ./backups/legalpro_$(date +%Y%m%d_%H%M%S).sql.gz

# 3. Verificar
ls -lh ./backups/
# Debe haber un archivo .sql.gz de tamaño > 0
```

### Opción B: Backup contra Railway (producción/staging)

```bash
# Railway te da la DATABASE_URL completa. Extrae los componentes:
export DATABASE_URL="postgresql://user:***@host:port/dbname?sslmode=require"

# Usar el script backup.sh
BACKUP_DIR=./backups \
DATABASE_HOST=<host> \
DATABASE_PORT=<port> \
DATABASE_USER=<user> \
DATABASE_NAME=<dbname> \
DA****=<password> \
./tools/backup/backup.sh
```

---

## 🔄 Cómo restaurar

### ⚠️ ANTES DE RESTAURAR

1. **Confirma que es realmente necesario** — un restore borra todo el estado actual
2. **Crea un safety backup del estado actual** (el script lo hace automáticamente)
3. **Avisa al equipo** — restauración interrumpe servicio
4. **Ten listo el plan de rollback** por si la restauración falla

### Procedimiento

```bash
# Restaurar el backup más reciente
./tools/backup/restore.sh latest

# O un archivo específico
./tools/backup/restore.sh ./backups/legalpro_20260627_143000.sql.gz
```

El script:
1. Pide confirmación explícita
2. Crea safety backup del estado actual
3. Hace DROP del schema public
4. Desencripta si es .gpg
5. Ejecuta pg_restore
6. Registra en audit_log

---

## ⏰ Automatización (CRON en Railway)

### Railway Cron (recomendado)

En Railway, agregar un nuevo servicio `legalpro-backup` con:

```yaml
# railway.toml del servicio de backup
[deploy]
startCommand = "while true; do ./tools/backup/backup.sh && sleep 86400; done"

# Variables de entorno necesarias:
# DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_NAME, DATABASE_PASSWORD
# BACKUP_DIR=/backups (volume persistente)
# BACKUP_GPG_RECIPIENT=<tu-email> (opcional)
# AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (para S3, opcional)
# S3_BUCKET=legalpro-backups
```

### Alternativa: GitHub Actions scheduled

```yaml
# .github/workflows/backup.yml
name: Daily Backup
on:
  schedule:
    - cron: '0 6 * * *'  # 6 AM UTC diario
jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Install postgres client
        run: sudo apt-get install -y postgresql-client
      - name: Run backup
        env:
          DATABASE_HOST: ${{ secrets.RAILWAY_DB_HOST }}
          DATABASE_PORT: ${{ secrets.RAILWAY_DB_PORT }}
          DATABASE_USER: ${{ secrets.RAILWAY_DB_USER }}
          DATABASE_NAME: ${{ secrets.RAILWAY_DB_NAME }}
          DATABASE_PASSWORD: ${{ secrets.RAILWAY_DB_PASSWORD }}
          BACKUP_DIR: ./backups
        run: ./tools/backup/backup.sh
      - name: Upload to S3
        env:
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        run: aws s3 cp ./backups/ s3://legalpro-backups/ --recursive
```

---

## ✅ Verificación de integridad del backup

**CRÍTICO**: un backup que no se puede restaurar no es un backup.

### Test mensual (programar en calendario)

```bash
# 1. Crear BD de prueba local
docker run --name pg-restore-test -e POSTGRES_PASSWORD=test -d postgres:15-alpine

# 2. Restaurar último backup en la BD de prueba
DATABASE_HOST=localhost \
DATABASE_PORT=5432 \
DATABASE_USER=postgres \
DATABASE_NAME=postgres \
DAT****=test \
./tools/backup/restore.sh latest

# 3. Verificar conteo de tablas
docker exec pg-restore-test psql -U postgres -c "SELECT count(*) FROM information_schema.tables WHERE table_schema='public';"
# Esperado: > 30 tablas

# 4. Verificar que hay usuarios
docker exec pg-restore-test psql -U postgres -c "SELECT count(*) FROM usuarios;"
# Esperado: > 0

# 5. Limpiar
docker stop pg-restore-test && docker rm pg-restore-test
```

Si este test falla, **el backup está roto** y el procedimiento tiene un bug.

---

## 🆘 Disaster Recovery

Si la BD principal se corrompe o pierdes acceso:

1. **NO entres en pánico**
2. Lista los backups disponibles:
   ```bash
   ls -lh ./backups/  # local
   aws s3 ls s3://legalpro-backups/  # si usas S3
   ```
3. Elige el backup más reciente que se sabe bueno
4. Sigue el procedimiento de restauración arriba
5. **Verifica la aplicación** después de restaurar (smoke tests)
6. Si la restauración falla, escala el problema al equipo

---

## 📅 Log de actividad de backup

> Agregar entrada cada vez que se haga backup/restore real.

### [2026-06-27] — Configuración inicial
- Scripts existentes: `backup.sh` (genera dump + encripta + sube a S3 opcional)
- Scripts nuevos: `restore.sh` (con safety backup + confirmación)
- README creado: este documento
- Pendiente: configurar cron en Railway, verificar restore en frío