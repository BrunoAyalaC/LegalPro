# RB-006: PostgreSQL Down

## Metadata
- **Severidad**: P0
- **Owner**: @SRE + @Database
- **Última actualización**: 2026-06-12

## Síntomas
- `/health` retorna 500
- Errores de connection timeout
- Logs con "FATAL: password authentication failed"

## Pasos
1. Verificar estado de Railway: dashboard
2. Verificar logs de PostgreSQL
3. Si es instance: contactar Railway support
4. Si es nuestro config: revisar DATABASE_URL
5. Verificar SSL Mode (PGSSLMODE=Require)
6. Verificar pool exhausted (PG_POOL_SIZE)
7. Si pool exhausted: restart del servicio

## Compliance
- LPDP: data availability (medidas técnicas)
- ISO 27001 A.12.4

## Comunicación
- Slack: #ops + #status
- Status page: actualizar
