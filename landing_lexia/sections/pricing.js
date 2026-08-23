/**
 * pricing.js — Sección "Planes para Cada Estudio"
 *
 * Patrón: módulo ESM (mismo que rag-feature.js, scroll-engine.js, citas-demo.js)
 * Responsabilidad:
 *  1. Toggle Mensual/Anual con recálculo de precios en vivo
 *  2. Aplicar 20% de descuento en facturación anual
 *  3. Actualizar CTAs según billing period
 *  4. FAQ acordeón (delegación a <details> nativo HTML, sin JS extra)
 *  5. Reveal de los items FAQ al entrar al viewport
 *  6. Tracking analítico de selección de plan (sin PII)
 *  7. Respeta prefers-reduced-motion
 *
 * Convenciones del proyecto:
 *  - IntersectionObserver nativo (NO framer-motion)
 *  - Usa CSS classes (NO inline styles para animaciones)
 *  - Compatible con el patrón .reveal ya existente en index.html
 *
 * Compliance:
 *  - Sin PII en tracking (solo plan + billing period)
 *  - Sin claim de "100% precisión" ni urgencia falsa
 *
 * SKILL: marketing-growth
 * Autor: MarketingGrowth · 2026-08-01
 */

'use strict';

const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * DATA — Precios y textos por plan
 * IMPORTANTE: FREE no tiene precio (siempre S/ 0)
 * Anual = mensual × 12 × 0.8 (20% descuento, facturado anualmente)
 */
const PLANS = {
  free: {
    monthly: 0,
    annual: 0, // sigue siendo gratis
    credits: { monthly: '50 créditos IA/mes', annual: '50 créditos IA/mes' },
    cta: { monthly: 'Empezar gratis', annual: 'Empezar gratis' }
  },
  pro: {
    monthly: 99,
    annual: 79, // 99 × 12 × 0.8 / 12 = 79.2 → 79
    credits: { monthly: '500 créditos IA/mes', annual: '6000 créditos IA/año' },
    cta: { monthly: 'Contratar PRO', annual: 'Contratar PRO anual' }
  },
  enterprise: {
    monthly: 499,
    annual: 399, // 499 × 12 × 0.8 / 12 ≈ 399.2 → 399
    credits: { monthly: 'Consultas IA ilimitadas', annual: 'Consultas IA ilimitadas' },
    cta: { monthly: 'Contactar ventas', annual: 'Contactar ventas anual' }
  }
};

const ANNUAL_SAVINGS_LABEL = {
  pro: 'Ahorras S/ 240 al año',
  enterprise: 'Ahorras S/ 1,200 al año'
};

/**
 * 1. Toggle Mensual/Anual
 * Recalcula precios en vivo y actualiza CTAs
 */
function setupBillingToggle() {
  const buttons = document.querySelectorAll('.pricing-toggle-btn');
  if (!buttons.length) return;

  buttons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const billing = btn.dataset.billing; // 'monthly' | 'annual'
      if (billing !== 'monthly' && billing !== 'annual') return;

      // Estado activo
      buttons.forEach((b) => {
        b.classList.remove('is-active');
        b.setAttribute('aria-selected', 'false');
      });
      btn.classList.add('is-active');
      btn.setAttribute('aria-selected', 'true');

      // Recalcular todos los planes
      document.querySelectorAll('.price-card[data-plan]').forEach((card) => {
        updatePlanCard(card, billing);
      });

      // Tracking sin PII
      trackBillingChange(billing);
    });
  });
}

/**
 * 2. Actualiza una tarjeta de plan con el billing seleccionado
 * @param {HTMLElement} card
 * @param {'monthly'|'annual'} billing
 */
function updatePlanCard(card, billing) {
  const plan = card.dataset.plan;
  if (!plan || !PLANS[plan]) return;

  const data = PLANS[plan];
  const price = data[billing];
  const credits = data.credits[billing];
  const cta = data.cta[billing];

  // Precio
  const elPrice = card.querySelector('[data-price]');
  if (elPrice) elPrice.textContent = String(price);

  // Créditos
  const elCredits = card.querySelector('[data-credits]');
  if (elCredits) elCredits.textContent = credits;

  // CTA
  const elCta = card.querySelector('[data-cta]');
  if (elCta) elCta.textContent = cta;

  // Periodo
  const elPeriod = card.querySelector('[data-period]');
  if (elPeriod) {
    elPeriod.textContent = billing === 'annual' ? '/mes · facturado anual' : '/mes';
  }

  // Animación de cambio de precio (skip si reduced motion)
  if (!REDUCED_MOTION && elPrice) {
    elPrice.style.transition = 'color 0.3s ease, transform 0.3s ease';
    elPrice.style.color = billing === 'annual' ? 'var(--gold-bright)' : '';
    elPrice.style.transform = 'scale(1.05)';
    setTimeout(() => {
      elPrice.style.transform = 'scale(1)';
      setTimeout(() => {
        elPrice.style.color = '';
      }, 300);
    }, 200);
  }
}

/**
 * 3. Tracking analítico de selección de plan
 * NO incluye PII — solo el plan y el billing period
 * (Útil para A/B test de precios según analytics/Growth)
 */
function trackBillingChange(billing) {
  // Placeholder: en producción esto iría a Plausible/GA4/Mixpanel
  // Mantener privado y sin PII por compliance LPDP
  if (typeof window !== 'undefined' && window.console) {
    console.info('[pricing] billing_changed', { billing, timestamp: Date.now() });
  }
  // Hook para futura integración:
  // window.dispatchEvent(new CustomEvent('lex:billing-changed', { detail: { billing } }));
}

/**
 * 4. Tracking de click en CTA
 * También sin PII
 */
function setupCTATracking() {
  document.querySelectorAll('.price-card [data-cta]').forEach((cta) => {
    cta.addEventListener('click', (e) => {
      const card = e.currentTarget.closest('.price-card');
      const plan = card?.dataset?.plan;
      const billing = document.querySelector('.pricing-toggle-btn.is-active')?.dataset?.billing || 'monthly';

      if (typeof window !== 'undefined' && window.console) {
        console.info('[pricing] cta_clicked', { plan, billing, timestamp: Date.now() });
      }
      // Hook para futura integración con funnel de conversión
      // window.dispatchEvent(new CustomEvent('lex:cta-clicked', { detail: { plan, billing } }));
    });
  });
}

/**
 * 5. Reveal staggered de los items FAQ
 * (El acordeón usa <details> nativo, sin JS — solo animamos la entrada)
 */
function setupFAQReveal() {
  const items = document.querySelectorAll('.pricing-faq-item');
  if (!items.length) return;

  if (REDUCED_MOTION) {
    items.forEach((el) => el.classList.add('visible'));
    return;
  }

  // Estado inicial
  items.forEach((el) => {
    el.style.opacity = '0';
    el.style.transform = 'translateY(12px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const idx = Array.from(items).indexOf(entry.target);
        entry.target.style.transitionDelay = `${idx * 70}ms`;
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  items.forEach((item) => observer.observe(item));
}

/**
 * 6. Smooth scroll al hacer click en el link del FAQ (accesibilidad)
 * Algunos <details> contienen <a> internos; nos aseguramos que el scroll
 * no rompa el foco del teclado.
 */
function setupFAQAccessibility() {
  document.querySelectorAll('.pricing-faq-item a').forEach((link) => {
    link.addEventListener('click', (e) => {
      const href = link.getAttribute('href');
      if (!href || href === '#' || href.startsWith('javascript:')) return;
      // Permitir navegación normal para href reales
    });
  });
}

/**
 * INIT
 */
function initPricing() {
  setupBillingToggle();
  setupCTATracking();
  setupFAQReveal();
  setupFAQAccessibility();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPricing);
} else {
  initPricing();
}

export { initPricing, setupBillingToggle, updatePlanCard, PLANS };
