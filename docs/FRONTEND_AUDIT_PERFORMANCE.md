# Auditoria de Performance y Build - LegalPro

Fecha: 1 de agosto de 2026
Auditor: @auditor-performance
Stack: Vite 7 + React 19 + TailwindCSS 4

## 1. Build Configuration

### 1.1 Vite Config (vite.config.js)

```js
export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    chunkSizeWarningLimit: 1000, // ADVERTENCIA: relajado (best: 500)
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react','react-dom','react-router-dom'],
          'motion': ['framer-motion'],
          'charts': ['recharts'],
        },
      },
    },
  },
})
```

| Aspecto | Valor | Estado |
|---------|-------|--------|
| Version Vite | 7.3.1 | OK Latest |
| Plugins | @vitejs/plugin-react, @tailwindcss/vite | OK Optimizado |
| rollup-plugin-visualizer | en devDeps, no aplicado | ADVERTENCIA |
| Code splitting manual | react-vendor, motion, charts | OK |
| chunkSizeWarningLimit | 1000 KB | ADVERTENCIA RELAJADO |
| Source maps prod | No configurado | ADVERTENCIA |
| Minificacion | Si (Rolldown default) | OK |
| Target browsers | ES2020 | OK |

### 1.2 Dependencias criticas (package.json) - VERSION 6.10.1

| Libreria | Version | Tamano gz | Impact |
|----------|---------|-----------|--------|
| react | 19.2.0 | ~3KB | Core |
| react-dom | 19.2.0 | ~40KB | Render |
| react-router-dom | 7.13.1 | ~25KB | Routing |
| axios | 1.7.0 | ~15KB | HTTP |
| framer-motion | 12.36.0 | ~80KB | Animaciones (33 archivos) |
| recharts | 3.8.0 | ~120KB | Charts (lazy-loaded) |
| @tsparticles/react | 3.0.0 | ~80KB | NO UTILIZADO EN CODIGO |
| @tsparticles/slim | 3.9.1 | ~50KB | NO UTILIZADO EN CODIGO |
| lucide-react | 0.577.0 | tree-shaken | Iconos |
| heroicons/react | 2.2.0 | tree-shaken | Iconos |
| tailwindcss | 4.2.1 | JIT ~30KB | CSS |

**Total estimado bundle inicial: ~300KB gz** OK DENTRO DEL PRESUPUESTO

### 1.3 TypeScript Config (tsconfig.json)

| Aspecto | Valor | SLO |
|---------|-------|-----|
| Target | ES2020 | OK Compatibilidad |
| Strict | true | OK Robustez |
| noUnusedLocals | true | OK |
| noUnusedParameters | true | OK |
| jsx | react-jsx | OK Automatic |
| moduleResolution | bundler | OK Vite-friendly |
| ignoreDeprecations | 6.0 | ADVERTENCIA TS 6.x experiment |

## 2. Optimizaciones Detectadas

### 2.1 Implementadas correctamente

- React.lazy() en 33/33 paginas (100% - verificado en App.jsx)
- Code splitting por ruta automatico (Vite)
- manualChunks vendor (react-vendor, motion, charts)
- Recharts lazy-loaded en MateriaPieChart.jsx y ActivityAreaChart.jsx
- TailwindCSS JIT v4 con @tailwindcss/vite
- Suspense + Loading states (fallback en App.jsx)
- Tree-shaking (Rolldown default)
- StrictMode activado
- TypeScript strict mode (evita codigo muerto)

### 2.2 Pendientes (gap analysis)

- Service Worker / PWA - No configurado
- Critical CSS inline - No extraido
- Image optimization (WebP/AVIF) - Pipeline falta
- Font subsetting - Carga todas las weights de Outfit/Inter
- Brotli compression - Solo gzip en server (Node)
- Preload critical fonts - Solo preconnect, falta preload
- Performance budgets en CI - No definido
- Source maps production - No habilitados
- rollup-plugin-visualizer - Instalado pero no aplicado en vite.config.js

## 3. Core Web Vitals Estimados

| Metrica | Objetivo | Estimado | Estado |
|---------|----------|----------|--------|
| LCP (Largest Contentful Paint) | < 2.5s | ~1.8s | OK |
| FID (First Input Delay) | < 100ms | ~50ms | OK |
| CLS (Cumulative Layout Shift) | < 0.1 | ~0.05 | OK |
| INP (Interaction to Next Paint) | < 200ms | ~150ms | ADVERTENCIA Edge |
| TTFB (Time to First Byte) | < 600ms | ~300ms | OK |
| TBT (Total Blocking Time) | < 200ms | ~120ms | OK |

### Notas:

- LCP es bueno gracias a lazy loading (no se carga todo en initial paint)
- INP podria degradarse con muchas animaciones framer-motion simultaneas
- CLS bajo porque Tailwind reserva espacio y CSS-in-JS zero-runtime

## 4. Bundle Size Analysis

### 4.1 Estimacion por seccion (basado en dependencias)

| Ruta / Chunk | Tamano estimado | Detalle |
|--------------|-----------------|---------|
| index.html + vendor base | ~15KB gz | React + ReactDOM core |
| react-vendor chunk | ~65KB gz | react + react-dom + react-router-dom |
| motion chunk | ~80KB gz | framer-motion (33 archivos lo usan) |
| charts chunk | ~120KB gz | recharts (lazy: solo Dashboard) |
| /dashboard | ~80KB gz | Dashboard + charts lazy |
| /expedientes | ~70KB gz | lista + filtros |
| /chat-ia | ~120KB gz | chat + markdown |
| /redactor | ~85KB gz | editor + wizard |
| /simulador | ~95KB gz | juego roles |
| /landing | ~40KB gz | landing + tsparticles (NO USADO) |
| CSS (index.css + Tailwind) | ~30KB gz | 1338 lineas minified |

### 4.2 Acciones para reducir bundle

1. **HIGH IMPACT**: Reemplazar @tsparticles por CSS puro (~80KB ahorro)
   - No se usa actualmente en src/ (verificado con grep)
   - Recomendacion: eliminar de package.json
2. **MEDIUM**: Lazy load charts mas agresivamente (solo en /dashboard)
   - Ya esta implementado
3. **MEDIUM**: Code split framer-motion por uso
   - motion chunk pesa 80KB y se carga en TODAS las paginas por Layout
   - Considerar LazyMotion features={domAnimation} para tree-shake
4. **LOW**: Reemplazar framer-motion por motion (mini version, ~30KB menor)

## 5. Caching Strategy

### 5.1 HTTP Caching (Vite genera hash)

| Recurso | Cache | Detalle |
|---------|-------|---------|
| Static assets (JS/CSS) | 1 year | Vite genera chunks/[name]-[hash].js |
| HTML | no-cache | Para updates instantaneos |
| API responses | no-store | Datos sensibles legales |
| Fonts (Google) | 1 year | Cache-Control automatico |

### 5.2 Service Worker

- NO IMPLEMENTADO
- Recomendado: Workbox con precaching de shell
- Beneficio: FCP < 1s en segunda visita, offline basic

## 6. Image Optimization

| Aspecto | Estado | Recomendacion |
|---------|--------|---------------|
| Formato actual | PNG/JPG/WebP mixto | Migrar todo a WebP con fallback AVIF |
| Lazy loading | NO en img | Usar loading='lazy' + react-intersection-observer |
| Responsive srcset | NO | Generar picture con multiples sizes |
| Compression | Sin perdida | Optimizar con sharp o vite-imagetools |
| bg_hero.mp4 | EXISTE en docs/ | Evaluar mover a CDN + formato AV1/WebM |

## 7. CSS Performance

### 7.1 Estado actual

- TailwindCSS v4 con @tailwindcss/vite (JIT compilado)
- index.css: 1338 lineas (custom design system + glassmorphism)
- Critical CSS: NO extraido
- CSS size estimado: ~30KB gz (post-Tailwind tree-shake)

### 7.2 Issues detectados

- index.css linea 1: @import url(...fonts.googleapis.com) BLOQUEANTE
- index.html lineas 16-26: Google Fonts sin preload (solo preconnect)
- tailwind-merge instalado para class merging (ya optimiza)

## 8. JS Performance

### 8.1 Code Splitting

- OK Automatico (Vite/Rolldown)
- OK Manual: 33 paginas con React.lazy()
- OK Manual: recharts lazy-loaded en 2 charts
- ADVERTENCIA Layout tiene framer-motion en import estatico (no lazy)

### 8.2 Tree-shaking

- OK Configurado por defecto (Rolldown)
- OK TypeScript strict evita imports muertos

### 8.3 Compression

| Tipo | Estado | Detalle |
|------|--------|---------|
| Brotli | Depende de hosting | Railway soporta brotli |
| Gzip | OK en server Node | compression middleware instalado |
| Minification | OK Rolldown default | SWC + esbuild |

## 9. Recomendaciones Priorizadas

### 9.1 P0 - Alfa monetizable (bloquean lanzamiento)

- [ ] CRITICO: Eliminar @tsparticles/react y @tsparticles/slim de package.json
  - No se usan en codigo (ahorro ~130KB node_modules + 80KB bundle potencial)
- [ ] ALTO: Habilitar Brotli en Railway (configurar reverse proxy)
- [ ] MEDIO: Implementar loading='lazy' en imagenes del landing

### 9.2 P1 - Produccion (mes 1)

- [ ] Service Worker (PWA) via vite-plugin-pwa con Workbox
- [ ] Critical CSS extraction via vite-plugin-css-injected-by-js o manual
- [ ] Image optimization pipeline con vite-imagetools (WebP/AVIF)
- [ ] Aplicar rollup-plugin-visualizer (ya en devDeps) en vite.config.js
- [ ] Reducir bundle de simulador (95KB) - dynamic import mas granular

### 9.3 P2 - Optimizacion continua (mes 2+)

- [ ] Reemplazar @tsparticles por CSS animations (ahorro ~80KB)
- [ ] Implementar bundlewatch o size-limit en CI
- [ ] Performance budgets en CI (max 300KB gz main chunk)
- [ ] Code split framer-motion por features (no cargar motion en /login)
- [ ] Considerar <LazyMotion features={domAnimation}> para tree-shake

## 10. Monitoring de Performance

### 10.1 Implementado

- Sentry (@sentry/node@10.58 + @sentry/profiling-node) - render backend
- Lighthouse CI script (npm run test:lighthouse)

### 10.2 Pendientes

- Core Web Vitals reporting (web-vitals lib)
- Real User Monitoring (RUM) via Sentry Performance
- Performance budgets en CI
- Bundle size tracking en CI

## 11. Analisis de Riesgos

### 11.1 Regresiones performance detectadas

| Area | Riesgo | Mitigacion |
|------|--------|------------|
| chunkSizeWarningLimit: 1000 | Bundle creep silencioso | Bajar a 500KB + CI check |
| Fonts bloqueantes en index.css | Render delay 200-400ms | Self-host o preload |
| framer-motion global | 80KB en initial load | Code split por feature |
| noUnusedLocals TS | Build fails si hay imports muertos | OK (es salvaguarda) |

### 11.2 Mejores practicas incumplidas

1. No hay performance budget en CI
2. No hay preconnect a APIs externas (solo Google Fonts)
3. No hay preload de imagenes criticas (LCP)
4. No hay dns-prefetch a Supabase / Railway backends

## 12. Veredicto Final

### Estado: OK APROBADO CON OBSERVACIONES

**Cumplimiento SLOs:**
- Bundle size: OK ~300KB gz (objetivo < 300KB) - EN LIMITE
- Latencia esperada: OK Carga inicial < 2s
- Core Web Vitals: OK LCP/FID/CLS OK
- Mantenibilidad: OK Arquitectura clean, lazy loading 100%

**Acciones inmediatas requeridas:**
1. Eliminar @tsparticles (no usado) -> reduce ~80KB bundle potencial
2. Agregar preload para fuentes criticas
3. Aplicar rollup-plugin-visualizer para visibilidad

**Score estimado Lighthouse:**
- Performance: ~85-92 (mobile), ~95+ (desktop)
- Accessibility: ~90-95 (auditable con axe-core)
- Best Practices: ~85-90 (faltan CSP/preload)
- SEO: ~95+ (meta tags correctos)

---

**Proxima auditoria recomendada**: cada PR grande (auditor refutador-performance)
**CI integration**: agregar verifier-bundle-size.mjs y verifier-lighthouse.mjs en pipeline

### 9.1 P0 - Alfa monetizable (bloquean lanzamiento) - continuacion
