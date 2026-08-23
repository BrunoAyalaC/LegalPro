#!/usr/bin/env bash
# tools/backup/backup.sh
# Generado por @devops + @SRE
# Script de backup automatico de PostgreSQL

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/legalpro}"
S3_BUCKET="${S3_BUCKET:-legalpro-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-90}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/legalpro_${TIMESTAMP}.sql.gz"
ENCRYPTED_FILE="${BACKUP_FILE}.gpg"

mkdir -p "$BACKUP_DIR"

echo "[BACKUP] Iniciando backup a las $TIMESTAMP"

# 1. Dump
echo "[BACKUP] Ejecutando pg_dump..."
PGPASSWORD="$DATABASE_PASSWORD" pg_dump \
  --host="$DATABASE_HOST" \
  --port="$DATABASE_PORT" \
  --username="$DATABASE_USER" \
  --dbname="$DATABASE_NAME" \
  --no-owner \
  --no-privileges \
  --format=custom \
  --compress=9 \
  --file="$BACKUP_FILE"

# 2. Verificar
if [ ! -f "$BACKUP_FILE" ]; then
  echo "[BACKUP] ERROR: pg_dump no produjo archivo" >&2
  exit 1
fi
SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
echo "[BACKUP] Backup creado: $BACKUP_FILE ($SIZE)"

# 3. Encriptar con GPG
if [ -n "${BACKUP_GPG_RECIPIENT:-}" ]; then
  echo "[BACKUP] Encriptando con GPG para $BACKUP_GPG_RECIPIENT..."
  gpg --batch --yes --trust-model always \
    -e -r "$BACKUP_GPG_RECIPIENT" \
    -o "$ENCRYPTED_FILE" \
    "$BACKUP_FILE"
  rm -f "$BACKUP_FILE"
  BACKUP_FILE="$ENCRYPTED_FILE"
fi

# 4. Subir a S3
if [ -n "${AWS_ACCESS_KEY_ID:-}" ]; then
  echo "[BACKUP] Subiendo a s3://$S3_BUCKET/..."
  aws s3 cp "$BACKUP_FILE" "s3://$S3_BUCKET/daily/${TIMESTAMP}.sql.gz.gpg"
fi

# 5. Limpiar backups antiguos
echo "[BACKUP] Limpiando backups > $RETENTION_DAYS dias..."
find "$BACKUP_DIR" -type f -name "*.sql*" -mtime +$RETENTION_DAYS -delete

# 6. Audit log
echo "[BACKUP] Audit log..."
PGPASSWORD="$DATABASE_PASSWORD" psql \
  -h "$DATABASE_HOST" -U "$DATABASE_USER" -d "$DATABASE_NAME" \
  -c "INSERT INTO audit_log (event_name, severity, payload_masked, created_at) VALUES ('BACKUP_CREATED', 'INFO', '{\"file\":\"$BACKUP_FILE\",\"size\":\"$SIZE\"}'::jsonb, NOW())" || true

echo "[BACKUP] OK - Backup completado"
