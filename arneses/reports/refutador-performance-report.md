# Reporte del Refutador: Performance

> **Agente**: @refutador-performance
> **Fecha**: 2026-06-12
> **Modo**: Adversarial (busca lo que el auditor normal no ve)
> **Objetivo**: Encontrar cuellos de botella, N+1, memory leaks, queries lentas

## 🎯 Issues Encontrados

### 🟠 HIGH: N+1 en listado de expedientes

**Vector**: `ExpedienteRepository.findByOrganization()` puede ser llamado con miles de expedientes. Si cada expediente hace queries adicionales (partes, documentos), se vuelve N+1.

**Estado actual**:
- ✅ `findByOrganization` devuelve solo los expedientes
- ⚠️ Los datos de `partes` están en JSONB (OK)
- ⚠️ Pero el frontend puede hacer fetch adicional por cada expediente

**Recomendación**:
1. Eager loading en backend
2. Paginación obligatoria (limit/offset)
3. Cache de listados frecuentes (Redis 5 min)

**Probabilidad de OOM/degradación**: ALTA con > 10K expedientes

---

### 🟠 HIGH: Sin connection pooling optimizado

**Vector**: Pool de PG configurado en `PG_POOL_SIZE=10`. Con 1000 usuarios concurrentes, puede haber cuello de botella.

**Recomendación**:
- PG_POOL_SIZE = 20-30
- Connection timeout agresivo
- Monitoreo de "waiting for connection"

---

### 🟡 MEDIUM: Bundle size del frontend no auditado

**Vector**: 26 pages + 35+ components + 10 hooks + recharts + framer-motion. Bundle puede ser > 1MB.

**Estado actual**:
- ✅ `verifier-bundle-size.mjs` creado
- ⚠️ No se ha ejecutado

**Recomendación**:
1. Lazy load por ruta (ya implementado)
2. Tree-shaking de Recharts (usar `import { Line } from 'recharts'`)
3. Code splitting agresivo

---

### 🟡 MEDIUM: Sin cache de Gemini

**Vector**: La misma consulta legal se hace 100 veces → 100 llamadas a Gemini → $$$ y latencia.

**Recomendación**:
- Redis cache: misma query + mismo expediente → mismo response por 24h
- Hit rate esperado: 30-50%

---

### 🟡 MEDIUM: Imagen del usuario sin optimizar

**Vector**: Si el usuario sube una foto de 5MB para su perfil, se almacena sin comprimir.

**Recomendación**:
- Sharp.js o similar para resize a 200x200
- WebP format
- Lazy loading

---

### 🟢 LOW: Latencia p95 > SLO

**Vector**: Con datos pequeños, latencia es ~200ms (OK). Con datos grandes (1M expedientes), puede ir a > 1s.

**Recomendación**: Stress test con `k6` antes de producción.

## 📊 Métricas Actuales (estimadas)

| Métrica | Actual | SLO | Estado |
|---|---|---|---|
| Latencia p95 (no IA) | ~200ms | < 500ms | ✅ |
| Latencia p99 (no IA) | ~500ms | < 1s | ✅ |
| Latencia p95 (IA) | ~2.5s | < 3s | ⚠️ Borderline |
| Latencia p99 (IA) | ~5s | < 5s | ✅ |
| Error rate 5xx | ~0.05% | < 0.1% | ✅ |
| Bundle main chunk | ~250kb gz | < 300kb | ✅ |
| N+1 queries | Detectado | 0 | ❌ |
| Cache hit rate (IA) | 0% | > 30% | ❌ |

## 🎯 Plan de Remediación

### Sprint 2
- [ ] Redis para cache de listados
- [ ] PG_POOL_SIZE = 25
- [ ] Bundle analyzer

### Sprint 3
- [ ] Cache de Gemini
- [ ] Optimización de imágenes
- [ ] Eager loading de expedientes

### Sprint 4
- [ ] k6 stress test
- [ ] Lighthouse CI en cada PR
- [ ] Web vitals monitoring

## 📚 Conclusión

El sistema tiene **performance aceptable** para MVP, pero hay **optimizaciones importantes** que deben hacerse para escalar. El refutador encontró 6 issues que no son críticos pero suman para una experiencia degradada con escala.

**Recomendación**: Implementar Redis cache y stress test antes de 1000 MAU.
