# Designación de DPO (Data Protection Officer) — LegalPro

**Fecha de designación:** 1 de agosto de 2026
**Versión:** 1.0
**Estado:** Vigente

---

## Responsable Designado

**Nombre:** [A COMPLETAR POR EL EQUIPO]
**Cargo:** Data Protection Officer (DPO)
**Email de contacto:** dpo@legalpro.app
**Teléfono:** [A COMPLETAR]

## Marco Normativo

- Ley N° 29733 — Ley de Protección de Datos Personales (Perú)
- D.S. N° 016-2024-JUS — Reglamento de la LPDP
- R.D. N° 100-2025-JUS-DGTAIPD — Directiva Oficial de Datos Personales

## Funciones del DPO

Conforme al Art. 35 del D.S. 016-2024-JUS:

1. **Asesoramiento** al titular del banco de datos personales y a los empleados
   sobre el cumplimiento de la normativa de protección de datos personales.

2. **Supervisión** del cumplimiento de la LPDP y su Reglamento al interior
   de la organización.

3. **Coordinación** con la Autoridad Nacional de Protección de Datos
   Personales (ANPDP) para efectos del cumplimiento de la normativa.

4. **Atención** de las consultas y reclamos de los titulares de los datos
   personales.

5. **Información** al titular del banco de datos personales y a los empleados
   sobre sus obligaciones en materia de protección de datos personales.

6. **Verificación** de la implementación de las medidas de seguridad técnicas
   y organizativas.

## Datos de Contacto Publicados

Conforme al Art. 18 de la LPDP, este documento debe ser público y accesible
desde la Política de Privacidad.

### En la Política de Privacidad

Agregar al final de `legalpro-app/docs/POLITICA_PRIVACIDAD.md`:

```markdown
## Contacto del DPO

Para cualquier consulta, reclamo o ejercicio de derechos ARCO, puede
contactar a nuestro Data Protection Officer:

- **Email:** dpo@legalpro.app
- **Tiempo de respuesta:** 5 días hábiles máximo
- **Horario:** Lunes a viernes, 9:00 - 18:00 (PET)
```

## Procedimiento ARCO

El DPO es responsable de:

1. Recibir solicitudes ARCO (Acceso, Rectificación, Cancelación, Oposición)
2. Validar identidad del titular (máximo 5 días hábiles)
3. Gestionar internamente con equipo técnico
4. Responder al titular en máximo 8 días hábiles (Art. 36 LPDP)

Endpoints técnicos:
- `GET /api/mis-datos` (Acceso)
- `PUT /api/mis-datos` (Rectificación)
- `POST /api/mis-datos/cancelar` (Cancelación)
- `POST /api/mis-datos/oposicion` (Oposición)
- `GET /api/mis-datos/export` (Acceso - exportación)
- `DELETE /api/mis-datos/consentimiento/:tipo` (Revocación)

## Bitácora del DPO

| Fecha | Acción | Responsable |
|-------|--------|-------------|
| 2026-08-01 | Designación inicial | Pendiente |
| 2026-08-01 | Incidente: exposición de secretos (severidad crítica) | Pendiente |
