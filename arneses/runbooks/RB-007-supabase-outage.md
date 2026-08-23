# RB-007: Supabase Outage

## Metadata
- **Severidad**: P0
- **Owner**: @SRE + @DevOps
- **Última actualización**: 2026-06-12

## Síntomas
- Auth falla (login)
- Storage no responde
- Realtime desconectado

## Pasos
1. Verificar status.supabase.com
2. Si es Supabase down: esperar
3. Si es nuestro config: revisar SUPABASE_URL, SUPABASE_SERVICE_KEY
4. Si Auth cae: switch a JWT propio
5. Si Storage cae: switch a S3/R2
6. Si Realtime cae: usar polling

## Compliance
- LPDP: continuidad del servicio
- ISO 27001 A.16.1

## Comunicación
- Slack: #ops + #status
- Status page
