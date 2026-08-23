/**
 * rag-feature.js — Sección "Inteligencia Legal con Base Actualizada" (RAG)
 *
 * Patrón: módulo ESM (mismo que scroll-engine.js)
 * Responsabilidad:
 *  1. Reveal staggered de las 6 tarjetas RAG al entrar al viewport
 *  2. Reveal del bloque de prueba social con delay mayor
 *  3. Counter animation para los números "319+", "18", "16"
 *  4. Respeta prefers-reduced-motion
 *
 * Convenciones del proyecto:
 *  - Usa IntersectionObserver nativo (NO framer-motion)
 *  - Usa CSS classes (NO inline styles para animaciones)
 *  - Compatible con el patrón .reveal ya existente en index.html
 */

'use strict';

const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 1. Stagger reveal de las tarjetas RAG
 * Aplica transition-delay incremental y añade clase .visible
 * cuando la card entra al viewport.
 */
function setupRAGCardReveal() {
  const cards = document.querySelectorAll('.rag-card');
  if (!cards.length) return;

  // Estado inicial (en JS para no romper SSR / no-JS)
  cards.forEach((card) => {
    if (REDUCED_MOTION) {
      card.classList.add('visible');
      return;
    }
    card.style.opacity = '0';
    card.style.transform = 'translateY(24px)';
    card.style.transition =
      'opacity 0.55s cubic-bezier(0.16,1,0.3,1), transform 0.55s cubic-bezier(0.16,1,0.3,1)';
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const idx = Number(entry.target.dataset.idx || 0);
        entry.target.style.transitionDelay = `${idx * 90}ms`;
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  cards.forEach((c) => observer.observe(c));
}

/**
 * 2. Reveal del bloque de prueba social + disclaimer
 */
function setupRAGSocialReveal() {
  const targets = document.querySelectorAll('.rag-social, .rag-disclaimer');
  if (!targets.length) return;

  targets.forEach((el) => {
    if (REDUCED_MOTION) {
      el.classList.add('visible');
      return;
    }
    el.style.opacity = '0';
    el.style.transform = 'translateY(18px)';
    el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  });

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        entry.target.style.opacity = '1';
        entry.target.style.transform = 'translateY(0)';
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.3 }
  );

  targets.forEach((t) => observer.observe(t));
}

/**
 * 3. Counter animation para los números RAG
 * 319+ documentos · 18 materias · 16 fuentes
 * Usa requestAnimationFrame con easing easeOutExpo (mismo que scroll-engine.js)
 */
function setupRAGCounters() {
  const counters = [
    { id: 'rag-cnt-docs',   target: 319, suffix: '+' },
    { id: 'rag-cnt-materias', target: 18,  suffix: '' },
    { id: 'rag-cnt-fuentes',  target: 16,  suffix: '' }
  ];

  counters.forEach(({ id, target, suffix }) => {
    const el = document.getElementById(id);
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);

          if (REDUCED_MOTION) {
            el.textContent = `${target}${suffix}`;
            return;
          }

          const duration = 1500;
          const startTime = performance.now();

          function step(now) {
            const elapsed = now - startTime;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutExpo
            const eased =
              progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
            const current = Math.floor(eased * target);
            el.textContent = `${current}${suffix}`;
            if (progress < 1) requestAnimationFrame(step);
          }

          requestAnimationFrame(step);
        });
      },
      { threshold: 0.5 }
    );

    observer.observe(el);
  });
}

/**
 * INIT
 */
function initRAGFeature() {
  setupRAGCardReveal();
  setupRAGSocialReveal();
  setupRAGCounters();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initRAGFeature);
} else {
  initRAGFeature();
}

export { initRAGFeature, setupRAGCardReveal, setupRAGSocialReveal, setupRAGCounters };
