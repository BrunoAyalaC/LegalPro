# Reporte del Refutador: Arquitectura

> **Agente**: @refutador-arquitectura
> **Fecha**: 2026-06-12
> **Modo**: Adversarial (cuestiona decisiones arquitectónicas)
> **Objetivo**: Encontrar anti-patrones, deuda técnica, problemas de mantenibilidad

## 🎯 Anti-patrones Encontrados

### 🟠 HIGH: God Class en `LegalPro.Infrastructure.Services.GeminiService.cs`

**Vector**: El servicio de Gemini hace demasiado:
- Llama al SDK
- Valida citas
- Aplica disclaimers
- Mide costos
- Aplica circuit breaker
- Cache
- Logging

**Recomendación**: Dividir en `GeminiService` (orquestador) + `CitationValidator` + `DisclaimerApplier` + `CostCalculator` + `CircuitBreaker` + `GeminiCache`.

**Probabilidad de cambio**: 0.6 (alto)

---

### 🟠 HIGH: Acoplamiento fuerte a `Supabase.Auth` y `Supabase.Storage`

**Vector**: El código de negocio llama directamente a Supabase. Si cambian de Supabase a otro proveedor, hay que reescribir.

**Recomendación**: Implementar adaptadores `IAuthProvider` + `IStorageProvider` (ya iniciado en esta ola).

**Probabilidad de cambio**: 0.4

---

### 🟡 MEDIUM: Falta Circuit Breaker global

**Vector**: Solo Gemini tiene circuit breaker. ¿Qué pasa si Supabase cae?

**Recomendación**: Implementar `CircuitBreaker` reutilizable con `opossum` o similar.

---

### 🟡 MEDIUM: Sin Bulkhead pattern

**Vector**: Un endpoint pesado puede agotar el pool de conexiones.

**Recomendación**: Configurar `pools` separados por tipo de operación:
- `pg.pools.read` (lectura, 20 conexiones)
- `pg.pools.write` (escritura, 10)
- `pg.pools.ia` (IA, 5)

---

### 🟡 MEDIUM: Falta event sourcing para acciones críticas

**Vector**: No hay registro inmutable de "quién hizo qué" más allá del audit log.

**Recomendación**: Implementar outbox pattern (ya iniciado) para eventos críticos (suspensión de tenant, refund, etc.).

---

### 🟢 LOW: Uso de `Date.now()` en lugar de `DateTime.UtcNow` (.NET)

**Vector**: Timezone bugs.

**Recomendación**: Usar `DateTimeOffset.UtcNow` y convertir en presentación.

---

## 📊 Deuda Técnica Cuantificada

| Tipo | Días de trabajo | Prioridad |
|---|---|---|
| God Class refactoring | 5 | HIGH |
| Adapters Supabase | 3 | HIGH |
| Circuit Breaker global | 2 | MEDIUM |
| Bulkhead pattern | 2 | MEDIUM |
| Event Sourcing | 5 | MEDIUM |
| Timezone fixes | 0.5 | LOW |
| **Total** | **17.5 días** | |

## 🎯 Recomendación

Antes de 1000 MAU, ejecutar el refactoring de **God Class** + **Adapters Supabase**. El resto puede esperar.

## 💡 Conclusión

El sistema tiene **buena arquitectura** (Clean Architecture + CQRS) pero tiene **deuda técnica manejable** en servicios específicos. Nada crítico para MVP.

**Firmas requeridas**:
- [ ] @arquitecto-chief: Aprueba plan de refactor
- [ ] @backend-dotnet: Asigna tareas
- [ ] @release-manager: Decide prioridad
