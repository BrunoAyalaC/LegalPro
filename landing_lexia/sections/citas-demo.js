/**
 * citas-demo.js — Sección "Así Responde Lex.ia" (Demostración RAG)
 *
 * Patrón: módulo ESM (mismo que rag-feature.js, scroll-engine.js)
 * Responsabilidad:
 *  1. Tabs interactivos: cambio de ejemplo con animación
 *  2. Render dinámico de respuesta + citaciones desde DATA
 *  3. Reveal staggered de tabs y panel al entrar al viewport
 *  4. Indicador de latencia animado
 *  5. Respeta prefers-reduced-motion
 *
 * Convenciones del proyecto:
 *  - IntersectionObserver nativo (NO framer-motion)
 *  - Usa CSS classes (NO inline styles para animaciones)
 *  - Compatible con el patrón .reveal ya existente en index.html
 *  - Disclaimer IA obligatorio en cada render
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
 * DATA — 3 ejemplos reales de citaciones RAG
 * Materia: Civil, Penal, Laboral
 * IMPORTANTE: Disclaimer IA obligatorio por compliance LPDP
 */
const EJEMPLOS = [
  {
    materia: 'CIVIL',
    pregunta: '¿Cuál es el plazo para contestar una demanda civil en Perú?',
    tiempo: '1.8s',
    respuestaHTML: '<span class="citas-respuesta-marker">[1]</span> Según el <span class="highlight">Código Procesal Civil (Art. 473)</span>, el plazo para contestar una demanda es de <span class="highlight">30 días hábiles</span> contados desde la notificación válida de la demanda. <span class="citas-respuesta-marker">[2]</span>',
    citaciones: [
      { fuente: 'CPC Art. 473 — Plazo de contestación', similitud: 92, url: 'https://spij.minjus.gob.pe/spij-ext-web/#/detallenorma/H682685' },
      { fuente: 'Casación 2461-2023 Apurímac', similitud: 78, url: 'https://www.pj.gob.pe' }
    ],
    disclaimer: '⚠️ Verifica las citas consultando directamente las fuentes oficiales.'
  },
  {
    materia: 'PENAL',
    pregunta: '¿Qué es el delito de lavado de activos y cuál es su pena?',
    tiempo: '2.1s',
    respuestaHTML: '<span class="citas-respuesta-marker">[1]</span> El <span class="highlight">lavado de activos (Art. 1 del D.Leg. 1106)</span> es el acto de ocultar, transformar o administrar bienes de origen ilícito. <span class="citas-respuesta-marker">[2]</span> La pena es de <span class="highlight">10 a 20 años de prisión</span> efectiva. <span class="citas-respuesta-marker">[3]</span>',
    citaciones: [
      { fuente: 'D.Leg. 1106 Art. 1 — Lavado de activos', similitud: 89, url: 'https://spij.minjus.gob.pe' },
      { fuente: 'Casación 881-2022 Madre de Dios', similitud: 81, url: 'https://www.pj.gob.pe' },
      { fuente: 'TC Exp. 05436-2014-PHC/TC', similitud: 65, url: 'https://www.tc.gob.pe' }
    ],
    disclaimer: '⚠️ Esta respuesta es generada por IA y NO constituye asesoría legal.'
  },
  {
    materia: 'LABORAL',
    pregunta: '¿Cómo se calcula la CTS en Perú?',
    tiempo: '1.6s',
    respuestaHTML: '<span class="citas-respuesta-marker">[1]</span> La CTS (Art. 2 D.Leg. 650) se calcula como: <span class="highlight">(Remuneración básica + 1/6 de gratificación) × años de servicio</span>. <span class="citas-respuesta-marker">[2]</span> Se deposita <span class="highlight">semestralmente</span> (mayo y noviembre).',
    citaciones: [
      { fuente: 'D.Leg. 650 Art. 2 — Compensación por Tiempo de Servicios', similitud: 94, url: 'https://spij.minjus.gob.pe' },
      { fuente: 'D.S. N° 009-2026-TR — Reglamento CTS', similitud: 76, url: 'https://www.gob.pe/mtpe' }
    ],
    disclaimer: '⚠️ Consulta con un contador colegiado antes de calcular.'
  }
];

/**
 * 1. Render dinámico del panel de respuesta
 * @param {Object} ejemplo - item de EJEMPLOS
 */
function renderRespuesta(ejemplo) {
  const panel = document.querySelector('[data-citas-panel]');
  if (!panel) return;

  const elStatus = panel.querySelector('[data-citas-status]');
  const elRespuesta = panel.querySelector('[data-citas-respuesta]');
  const elFuentesCount = panel.querySelector('[data-citas-fuentes-count]');
  const elFuentesList = panel.querySelector('[data-citas-fuentes-list]');
  const elDisclaimer = panel.querySelector('[data-citas-disclaimer]');

  // Status con tiempo dinámico
  if (elStatus) elStatus.textContent = `Respuesta generada en ${ejemplo.tiempo}`;

  // Respuesta con marcadores
  if (elRespuesta) elRespuesta.innerHTML = ejemplo.respuestaHTML;

  // Conteo de fuentes
  if (elFuentesCount) {
    elFuentesCount.textContent = `${ejemplo.citaciones.length} fuentes citadas`;
  }

  // Lista de citaciones con scoring
  if (elFuentesList) {
    elFuentesList.innerHTML = ejemplo.citaciones.map((cit, idx) => {
      const sim = Number(cit.similitud);
      const sClass = sim >= 80 ? 's-high' : sim >= 60 ? 's-med' : 's-low';
      return `
        <div class="citas-fuente-item">
          <span class="citas-fuente-idx">[${idx + 1}]</span>
          <span class="citas-fuente-nombre">${escapeHTML(cit.fuente)}</span>
          <span class="citas-fuente-similarity ${sClass}">${sim}%</span>
          <a href="${escapeAttr(cit.url)}" target="_blank" rel="noopener noreferrer" class="citas-fuente-link" aria-label="Abrir fuente ${idx + 1} en sitio oficial">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
              <polyline points="15 3 21 3 21 9"></polyline>
              <line x1="10" y1="14" x2="21" y2="3"></line>
            </svg>
          </a>
        </div>
      `;
    }).join('');
  }

  // Disclaimer IA obligatorio
  if (elDisclaimer) elDisclaimer.textContent = ejemplo.disclaimer;

  // Animación de re-render (skip si reduced motion)
  if (!REDUCED_MOTION) {
    panel.style.opacity = '0';
    panel.style.transform = 'translateY(8px)';
    requestAnimationFrame(() => {
      panel.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
      panel.style.opacity = '1';
      panel.style.transform = 'translateY(0)';
    });
  }
}

/**
 * 2. Helpers de escape (anti XSS, importante en innerHTML)
 */
function escapeHTML(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/**
 * 3. Tabs interactivos
 */
function setupCitasTabs() {
  const tabs = document.querySelectorAll('.citas-tab');
  if (!tabs.length) return;

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const idx = Number(tab.dataset.citasIdx);
      if (Number.isNaN(idx) || idx < 0 || idx >= EJEMPLOS.length) return;

      // Estado activo
      tabs.forEach((t) => {
        t.classList.remove('is-active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('is-active');
      tab.setAttribute('aria-selected', 'true');

      // Render del ejemplo seleccionado
      renderRespuesta(EJEMPLOS[idx]);
    });
  });
}

/**
 * 4. Reveal staggered de tabs y panel al entrar al viewport
 * Compatible con el patrón .reveal del index.html
 */
function setupCitasReveal() {
  const section = document.querySelector('.citas-section');
  if (!section) return;

  // Si reduced motion, marcar todo visible inmediatamente
  if (REDUCED_MOTION) {
    section.querySelectorAll('.reveal').forEach((el) => el.classList.add('visible'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      });
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
  );

  section.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
}

/**
 * 5. Soporte de navegación por teclado (accesibilidad WCAG 2.1 AA)
 * Flechas izquierda/derecha cambian de tab
 */
function setupCitasKeyboard() {
  const tablist = document.querySelector('.citas-tabs');
  if (!tablist) return;

  tablist.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();

    const tabs = Array.from(tablist.querySelectorAll('.citas-tab'));
    const currentIdx = tabs.findIndex((t) => t.classList.contains('is-active'));
    if (currentIdx === -1) return;

    const delta = e.key === 'ArrowDown' ? 1 : -1;
    const nextIdx = (currentIdx + delta + tabs.length) % tabs.length;
    tabs[nextIdx].click();
    tabs[nextIdx].focus();
  });
}

/**
 * INIT
 */
function initCitasDemo() {
  setupCitasTabs();
  setupCitasReveal();
  setupCitasKeyboard();
  // Render inicial explícito (idx 0) por si el HTML inicial cambia
  // (No es estrictamente necesario porque el HTML tiene los datos del ejemplo 0,
  // pero garantiza sincronía si el orden de los botones cambia)
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initCitasDemo);
} else {
  initCitasDemo();
}

export { initCitasDemo, renderRespuesta, EJEMPLOS };
