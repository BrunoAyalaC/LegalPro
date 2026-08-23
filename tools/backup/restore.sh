#!/usr/bin/env bash
# tools/backup/restore.sh
# Restaura un backup de PostgreSQL generado por backup.sh
#
# Uso:
#   ./restore.sh <archivo_backup.sql.gz[.gpg]>
#   ./restore.sh latest  # restaura el backup más reciente
#
# IMPORTANTE: Restaura DESTRUYE los datos actuales de la BD destino.
# Hacer SIEMPRE backup del estado actual antes de restaurar.

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/legalpro}"
DB_HOST="${DATABASE_HOST:?ERROR: DATABASE_HOST requerido}"
DB_PORT="${DATABASE_PORT:-5432}"
DB_USER="${DATABASE_USER:?ERROR: DATABASE_USER requerido}"
DB_NAME="${DATABASE_NAME:?ERROR: DATABASE_NAME requerido}"
DB_PASSWORD="${DATABASE_PASSWORD:?ERROR: DATABASE_PASSWORD requerido}"

# 1. Determinar archivo
if [ "${1:-}" = "latest" ]; then
  BACKUP_FILE=$(ls -t "$BACKUP_DIR"/legalpro_*.sql* 2>/dev/null | head -1)
  if [ -z "$BACKUP_FILE" ]; then
    echo "ERROR: No se encontraron backups en $BACKUP_DIR" >&2
    exit 1
  fi
  echo "[RESTORE] Usando backup más reciente: $BACKUP_FILE"
else
  BACKUP_FILE="${1:?ERROR: archivo de backup requerido como argumento}"
fi

if [ ! -f "$BACKUP_FILE" ]; then
  echo "ERROR: Archivo no existe: $BACKUP_FILE" >&2
  exit 1
fi

# 2. Confirmación explícita
echo "================================================"
echo "⚠️  RESTORE A POSTGRESQL"
echo "================================================"
echo "Archivo:  $BACKUP_FILE"
echo "Destino:  $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
echo "Tamaño:   $(du -h "$BACKUP_FILE" | cut -f1)"
echo "================================================"
read -p "¿Continuar? Escribe 'SI' para confirmar: " CONFIRM
if [ "$CONFIRM" != "SI" ]; then
  echo "Cancelado."
  exit 0
fi

# 3. Backup del estado actual (safety net)
echo "[RESTORE] Creando backup de seguridad del estado actual..."
SAFETY_FILE="$BACKUP_DIR/pre_restore_${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql.gz"
PGPASSWORD="$DB_PASSWORD" pg_dump \
  --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" --dbname="$DB_NAME" \
  --no-owner --no-privileges --format=custom --compress=9 \
  --file="$SAFETY_FILE" 2>/dev/null || echo "[RESTORE] WARN: No se pudo crear safety backup (¿BD vacía?)"
echo "[RESTORE] Safety backup: $SAFETY_FILE"

# 4. Drop y recreate schema
echo "[RESTORE] Drop schema public..."
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" \
  -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO $DB_USER;"

# 5. Desencriptar si es .gpg
WORK_FILE="$BACKUP_FILE"
if [[ "$BACKUP_FILE" == *.gpg ]]; then
  echo "[RESTORE] Desencriptando..."
  WORK_FILE="${BACKUP_FILE%.gpg}"
  gpg --batch --yes --decrypt "$BACKUP_FILE" > "$WORK_FILE"
fi

# 6. Restaurar
echo "[RESTORE] Restaurando $WORK_FILE..."
if [[ "$WORK_FILE" == *.gz ]]; then
  gunzip -c "$WORK_FILE" | PGPASSWORD="$DB_PASSWORD" pg_restore \
    --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" --dbname="$DB_NAME" \
    --no-owner --no-privileges --clean --if-exists \
    --schema=public -d "$DB_NAME"
else
  PGPASSWORD="$DB_PASSWORD" pg_restore \
    --host="$DB_HOST" --port="$DB_PORT" --username="$DB_USER" --dbname="$DB_NAME" \
    --no-owner --no-privileges --clean --if-exists \
    --schema=public -d "$DB_NAME" "$WORK_FILE"
fi

# 7. Audit log
echo "[RESTORE] Audit log..."
PGPASSWORD="$DB_PASSWORD" psql \
  -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" \
  -c "INSERT INTO audit_log (event_name, severity, payload_masked, created_at) VALUES ('RESTORE_EXECUTED', 'WARN', '{\"source\":\"$BACKUP_FILE\"}'::jsonb, NOW())" || true

echo "[RESTORE] OK - Restore completado desde $BACKUP_FILE"