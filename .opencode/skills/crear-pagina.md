---
name: crear-pagina
description: Crea pagina React 19 con Vite 7, TypeScript 6 estricto, TailwindCSS 4, React Router 7, Supabase, lazy load, accesibilidad WCAG 2.1 AA, Core Web Vitals.
when-to-use: "Cuando se pida crear una pagina nueva en legalpro-app o landing_lexia"
allowed-tools: Read, Write, Edit, Grep, Glob
updated: 2026-07-31
stack: React 19.2 + Vite 7.3 + TypeScript 6 + TailwindCSS 4.2 + React Router 7.13
accesibilidad: WCAG 2.1 AA (axe-core verde)
---

# crear-pagina (v3.0 RAG-optimized)

Crea páginas React production-ready con stack moderno: **React 19.2 + Vite 7.3 + TS 6 + TailwindCSS 4.2 + React Router 7.13**. Accesibilidad WCAG 2.1 AA y Core Web Vitals como primer-class citizens. **A julio 2026**.

## Inputs

```yaml
ruta: string  # ej: /expedientes/nuevo
componentes: [array de componentes a usar]
requiere_auth: bool
roles_permitidos: [OWNER | ADMIN | MEMBER | VIEWER]
layout: default | fullscreen | minimal | dashboard
toque_ia: bool      # si usa MiniMax
toque_pii: bool     # si muestra datos personales
```

## Output

- Archivo `legalpro-app/src/pages/XxxPage.jsx` (TypeScript estricto)
- Lazy load configurado en `App.jsx`
- AuthGuard + RoleGuard
- Layout apropiado
- WCAG 2.1 AA (axe-core verde)
- SEO meta tags
- Bundle contribution < 50kb gz

## Pasos (protocolo RAG)

1. **Crear archivo** `legalpro-app/src/pages/XxxPage.jsx`
2. **Estructura base** (TypeScript estricto):
   ```tsx
   import { lazy, Suspense } from 'react';
   import { ErrorBoundary } from 'react-error-boundary';
   import { AuthGuard } from '@/components/auth/AuthGuard';
   import { RoleGuard } from '@/components/auth/RoleGuard';
   import { Layout } from '@/components/layout/Layout';
   import { Skeleton } from '@/components/ui/Skeleton';
   import { IADisclaimerBanner } from '@/components/ia/IADisclaimerBanner';

   // Lazy load componentes pesados
   const HeavyComponent = lazy(() => import('@/components/heavy/HeavyComponent'));

   export default function XxxPage() {
     return (
       <Layout variant="default">
         {/* Skip links para accesibilidad */}
         <a href="#main" className="sr-only focus:not-sr-only">Saltar al contenido</a>

         <AuthGuard roles={['ADMIN', 'MEMBER']}>
           <main id="main" role="main" lang="es-PE">
             <h1>Título de la página</h1>
             {/* Banner IA si aplica (LPDP art. 21) */}
             {requiresIA && <IADisclaimerBanner />}

             <Suspense fallback={<Skeleton />}>
               <HeavyComponent />
             </Suspense>
           </main>
         </AuthGuard>
       </Layout>
     );
   }
   ```
3. **Lazy load + Suspense** en `App.jsx`:
   ```jsx
   const XxxPage = lazy(() => import('./pages/XxxPage'));
   <Route path="/expedientes/nuevo" element={<XxxPage />} />
   ```
4. **Accesibilidad WCAG 2.1 AA**:
   - Skip links (`<a href="#main">`)
   - `aria-label`, `aria-labelledby`, `aria-describedby` en interactivos
   - `role` apropiado en custom components
   - Focus visible (`focus-visible:ring-2`)
   - Focus trap en modales (`useFocusTrap`)
   - `prefers-reduced-motion` respetado
   - `loading="lazy"` en imágenes
   - Contraste ≥ 4.5:1 (texto) / ≥ 3:1 (grande)
   - `lang="es-PE"` en `<html>`
   - Tab order lógico
5. **Performance**:
   - `React.memo` para componentes puros
   - `useMemo`/`useCallback` donde aplique
   - Virtualización (`@tanstack/react-virtual`) para listas > 100 items
   - Imágenes con `next-gen` format (AVIF/WebP)
   - Code splitting por ruta
6. **i18n**:
   - `react-intl` con mensajes `es-PE`
   - Formato de fecha: `dd/MM/yyyy`
   - Formato de moneda: `S/ 1,234.56`
7. **Tests**:
   - Vitest + Testing Library (unit)
   - Playwright E2E (`legalpro-app/e2e/xxx-page.spec.js`)
   - axe-core en tests E2E

## Quality gates

- [ ] TypeScript estricto (`strict: true`)
- [ ] Lazy load + Suspense configurados
- [ ] AuthGuard + RoleGuard funcionales
- [ ] WCAG 2.1 AA (axe-core verde, 0 critical)
- [ ] Core Web Vitals: LCP < 2.5s, FID < 100ms, CLS < 0.1
- [ ] Bundle contribution < 50kb gz
- [ ] SEO meta tags (`<title>`, `<meta description>`, OG tags)
- [ ] Tests Vitest + Playwright pasan
- [ ] Lighthouse score ≥ 90 (Performance, Accessibility, SEO, Best Practices)

## Audit log

Emitir `PAGE_CREATED` con payload: `ruta, autor, bundle_size_kb, lighthouse_score, wcag_passes`.

## Stack actual (julio 2026)

| Tecnología | Versión | Uso |
|---|---|---|
| React | 19.2 | UI library |
| Vite | 7.3 | Bundler (HMR ultrarrápido) |
| TypeScript | 6.0 | Tipado estricto |
| TailwindCSS | 4.2 | Utility-first CSS |
| React Router | 7.13 | Routing (data router) |
| Framer Motion | 12.36 | Animaciones |
| Supabase JS | 2.50 | Auth + DB client |
| Vitest | 4.1 | Unit testing |
| Playwright | 1.58 | E2E testing |
| axe-core | 4.10 | Accesibilidad |

## Referencias

- `.opencode/agents/frontend.md`
- `.opencode/rules/frontend-react.md`
- `.opencode/rules/react-hooks.md`
- `tools/verifiers/verifier-accesibilidad.mjs`
- `tools/verifiers/verifier-bundle-size.mjs`
- React 19 docs: https://react.dev/reference
- Vite 7 docs: https://vite.dev/
- WCAG 2.1 AA: https://www.w3.org/WAI/WCAG21/quickref/?versions=2.1&levels=aa
- TailwindCSS 4: https://tailwindcss.com/docs
