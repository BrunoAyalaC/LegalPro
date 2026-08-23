# Notificación de Breach de Seguridad — 1 de agosto de 2026

## ⚠️ RESUMEN EJECUTIVO

**Severidad:** CRÍTICA  
**Tipo:** Exposición de secretos de producción en archivo de texto plano  
**Fecha detección:** 1 de agosto de 2026  
**Estado:** Remediación en curso

## SECRETOS COMPROMETIDOS

| # | Tipo | Servicio | Estado |
|---|------|----------|--------|
| 1 | API Key IA | MiniMax (cod-...) | 🔴 REQUIERE ROTACIÓN |
| 2 | Password DB | PostgreSQL Railway (postgres) | 🔴 REQUIERE ROTACIÓN |
| 3 | API Key IA | Google Gemini (clave de producción) | 🔴 REQUIERE ROTACIÓN |
| 4 | JWT Secret | Application | 🔴 REQUIERE ROTACIÓN |

## ACCIONES INMEDIATAS REQUERIDAS

### MiniMax API Key
1. Ir a https://platform.MiniMax.com → API Keys
2. Revocar la clave de producción afectada
3. Generar nueva clave
4. Actualizar variable `MiniMax_API_KEY` en Railway
5. Redesplegar backend Node + .NET

### Google Gemini API Key
1. Ir a https://console.cloud.google.com/apis/credentials
2. Revocar la clave de producción afectada
3. Crear nueva API Key con restricción de IP (Railway IPs)
4. Actualizar `GEMINI_API_KEY` en Railway
5. Redesplegar backend .NET

### PostgreSQL Password
1. En Railway → PostgreSQL → Variables → Reset Password
2. Copiar nueva DATABASE_URL
3. Actualizar en backend Node y .NET
4. Redesplegar

### JWT_SECRET
1. Generar nuevo secret: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`
2. Actualizar `JWT_SECRET` en Railway (backend Node y .NET)
3. **TODOS LOS USUARIOS DEBEN RE-LOGIN** (tokens existentes quedan inválidos)
4. Redesplegar

## ANÁLISIS DE EXPOSICIÓN

### Vector de exposición
- Archivo `datos.txt` en working tree
- Contenía secretos en texto plano desde inicio del proyecto
- **NO fue commiteado a git** (sin historial para la ruta y cubierto por `.gitignore` líneas 44-46)
- **Riesgo de exposición local**: medio (cualquiera con acceso al filesystem lo vio)

### Breach LPDP (Ley 29733 Art. 24)
- **Datos personales NO comprometidos directamente** (no había DNI/PII en el archivo)
- **Secretos de aplicación SÍ comprometidos** (vulnerabilidad técnica con riesgo potencial de acceso indirecto a datos personales)
- **Evaluación de notificación a ANPDP**: No requerida estrictamente con la evidencia disponible de exposición exclusivamente local y sin acceso no autorizado confirmado a datos personales; esta conclusión es provisional hasta concluir la auditoría de logs
- Si se confirma acceso, extracción, alteración o divulgación no autorizada de datos personales, escalar de inmediato a Gobernanza/DPO y cursar la notificación aplicable dentro de un plazo máximo de 5 días hábiles

## VERIFICACIÓN POST-REMEDIACIÓN

Una vez rotados todos los secretos:

- [ ] Verificar que `MiniMax_API_KEY` funciona con `curl https://api.MiniMax.com/v1/models -H "Authorization: Bearer $MiniMax_API_KEY"`
- [ ] Verificar que `GEMINI_API_KEY` funciona con `curl ...`
- [ ] Verificar login con nuevo JWT_SECRET (todos los usuarios deben re-autenticarse)
- [ ] Verificar conexión DB con nuevo password
- [ ] Ejecutar los 29 verificadores (`npm run verify:all`)
- [ ] Auditar logs de uso de las claves antiguas (búsqueda de actividad sospechosa)
