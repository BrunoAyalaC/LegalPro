/**
 * scroll-engine.js — Motor de scroll interactivo para Lex.ia landing
 * Design System 06-J Cinematic Dual Tone
 *
 * Funciones:
 *  1. Video backgrounds con scroll parallax
 *  2. Scroll-driven progress bars
 *  3. Parallax en capas (hero, chapters)
 *  4. Video seek controlado por scroll (justice-reveal)
 *  5. Sticky chapter numbers count-up al entrar
 *  6. Cursor trail glow opcional
 *  7. prefers-reduced-motion compliance
 */

'use strict';

/* ─── Feature detection ────────────────────────────────── */
const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const IS_MOBILE = window.innerWidth < 768;

/* ─── 1. VIDEO BACKGROUND MANAGER ─────────────────────── */
class VideoBackgroundManager {
  /**
   * @param {string} videoId  — id del elemento <video>
   * @param {object} options  — { parallaxFactor, sectionId }
   */
  constructor(videoId, options = {}) {
    this.video = document.getElementById(videoId);
    this.section = options.sectionId ? document.getElementById(options.sectionId) : null;
    this.parallaxFactor = options.parallaxFactor || 0.3;
    this.initialized = false;
    this._sectionTop = null;  // cached absolute position (no forced reflow en update)

    if (!this.video) return;
    this._init();
  }

  _init() {
    // En mobile no usamos parallax para preservar performance
    if (IS_MOBILE || REDUCED_MOTION) {
      this.video.parentElement.style.transform = 'none';
      return;
    }

    // will-change para promover al GPU compositor
    this.video.style.willChange = 'transform';

    this.video.addEventListener('canplay', () => {
      this.video.parentElement.style.opacity = '1';
      this.initialized = true;
      this._cachePosition();  // cache posición cuando el video esté listo
    }, { once: true });

    // Observer para pausar video fuera de viewport (save GPU)
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.video.play().catch(() => {});
        } else {
          this.video.pause();
        }
      });
    }, { threshold: 0.1 });

    observer.observe(this.video);

    // Recachear posición en resize
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this._cachePosition(), 150);
    }, { passive: true });
  }

  /** Cachea la posición ABSOLUTA (sin transforms) — una sola vez o en resize */
  _cachePosition() {
    if (!this.section) return;
    // Quitar transform temporalmente para leer posición natural
    const prevTransform = this.video.style.transform;
    this.video.style.transform = '';
    const rect = this.section.getBoundingClientRect();
    this._sectionTop = rect.top + window.scrollY;
    this.video.style.transform = prevTransform;
  }

  /** Llamar en cada frame del scroll loop — NO lee layout, solo escribe */
  applyParallax(scrollY) {
    if (!this.initialized || REDUCED_MOTION || IS_MOBILE) return;
    if (this._sectionTop === null) return;

    const offset = (scrollY - this._sectionTop) * this.parallaxFactor;
    this.video.style.transform = `translateY(${offset}px) scale(1.2)`;
  }
}

/* ─── 2. SCROLL-DRIVEN VIDEO SEEK ──────────────────────── */
/**
 * Controla la reproducción de un video según el scroll
 * Usa rAF para debounce — evita jank por currentTime en cada evento
 *
 * @param {string} videoId
 * @param {string} sectionId — sección que triggeriza el seek
 */
function setupScrollVideoSeek(videoId, sectionId) {
  if (REDUCED_MOTION) return;

  const video = document.getElementById(videoId);
  const section = document.getElementById(sectionId);
  if (!video || !section) return;

  // Cargar pero no reproducir automáticamente
  video.pause();
  video.currentTime = 0;
  video.style.willChange = 'transform';

  let hasStarted = false;
  // Cache posición absoluta de la sección
  let sectionAbsTop = section.getBoundingClientRect().top + window.scrollY;
  window.addEventListener('resize', () => {
    section.style.transform = '';
    sectionAbsTop = section.getBoundingClientRect().top + window.scrollY;
  }, { passive: true });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !hasStarted) {
        hasStarted = true;
        video.play().catch(() => {});
      }
    });
  }, { threshold: 0.4 });

  observer.observe(section);

  // Scroll seek con rAF debounce — no bloquea el main thread
  let rafPending = false;
  window.addEventListener('scroll', () => {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      const viewH = window.innerHeight;
      const scrollY = window.scrollY;
      const sectionHeight = section.offsetHeight;
      const relTop = sectionAbsTop - scrollY;

      if (relTop < viewH && relTop + sectionHeight > 0) {
        const progress = Math.max(0, Math.min(1,
          (viewH - relTop) / (viewH + sectionHeight)
        ));
        if (video.paused && video.duration) {
          video.currentTime = progress * video.duration;
        }
      }
    });
  }, { passive: true });
}

/* ─── 3. PARALLAX LAYERS ───────────────────────────────── */
class ParallaxLayer {
  /**
   * @param {string} selector — CSS selector del elemento
   * @param {number} speed    — velocidad (0.1 lento - 0.8 rápido)
   * @param {string} axis     — 'Y' (default) | 'X'
   *
   * IMPORTANTE: Cachea posiciones absolutas en init para evitar
   * forced reflow en cada frame del RAF loop.
   */
  constructor(selector, speed = 0.2, axis = 'Y') {
    this.speed = speed;
    this.axis = axis;
    this._cache = [];

    const elements = [...document.querySelectorAll(selector)];
    if (!elements.length) return;

    // Asignar will-change antes de cachear
    elements.forEach(el => {
      el.style.willChange = 'transform';
      el.style.transform = '';  // reset por si acaso
    });

    // Forzar un único reflow para leer posiciones naturales
    this._cache = elements.map(el => {
      const rect = el.getBoundingClientRect();
      return {
        el,
        // Posición ABSOLUTA en el documento (invariante ante scroll)
        absTop: rect.top + window.scrollY,
        height: rect.height,
      };
    });

    // Re-cachear solo en resize (no en scroll)
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this._recache(), 150);
    }, { passive: true });
  }

  _recache() {
    this._cache.forEach(item => {
      item.el.style.transform = '';
    });
    // Un único reflow aquí
    this._cache.forEach(item => {
      const rect = item.el.getBoundingClientRect();
      item.absTop = rect.top + window.scrollY;
      item.height = rect.height;
    });
  }

  /** Solo escribe transforms — nunca lee layout */
  update(scrollY) {
    if (REDUCED_MOTION || !this._cache.length) return;
    const viewCenterY = scrollY + window.innerHeight * 0.5;
    this._cache.forEach(({ el, absTop, height }) => {
      const elCenterY = absTop + height * 0.5;
      const offset = (viewCenterY - elCenterY) * this.speed;
      el.style.transform = this.axis === 'Y'
        ? `translateY(${offset}px)`
        : `translateX(${offset}px)`;
    });
  }
}

/* ─── 4. SCROLL PROGRESS BAR ───────────────────────────── */
function setupScrollProgressBar() {
  const bar = document.getElementById('scroll-progress-bar');
  if (!bar) return;

  window.addEventListener('scroll', () => {
    const scrollTop = window.scrollY;
    const docHeight = document.documentElement.scrollHeight - window.innerHeight;
    const progress = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;
    bar.style.width = `${progress}%`;
  }, { passive: true });
}

/* ─── 5. STICKY CHAPTER NUMBER EFFECT ──────────────────── */
function setupChapterNumbers() {
  const chapters = document.querySelectorAll('.chapter-number');
  if (!chapters.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('chapter-num-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  chapters.forEach(ch => observer.observe(ch));
}

/* ─── 6. CURSOR TRAIL GLOW (desktop only) ──────────────── */
class CursorTrail {
  constructor() {
    if (IS_MOBILE || REDUCED_MOTION) return;

    this.cursor = document.createElement('div');
    this.cursor.id = 'cursor-glow';
    this.cursor.style.cssText = `
      position: fixed;
      width: 300px; height: 300px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(6,182,212,0.06) 0%, transparent 70%);
      pointer-events: none;
      z-index: 9999;
      transform: translate(-50%, -50%);
      transition: opacity 0.3s ease;
      mix-blend-mode: screen;
    `;
    document.body.appendChild(this.cursor);

    this.x = 0; this.y = 0;
    this.targetX = 0; this.targetY = 0;

    window.addEventListener('mousemove', (e) => {
      this.targetX = e.clientX;
      this.targetY = e.clientY;
    });

    this._animate();
  }

  _animate() {
    this.x += (this.targetX - this.x) * 0.08;
    this.y += (this.targetY - this.y) * 0.08;
    this.cursor.style.left = `${this.x}px`;
    this.cursor.style.top = `${this.y}px`;
    requestAnimationFrame(() => this._animate());
  }
}

/* ─── 7. SECTION ENTRANCE WITH VIDEO OVERLAY ───────────── */
/**
 * Maneja el fade in/out del overlay oscuro sobre el video
 * según qué tan visible está la sección
 */
function setupVideoOverlayFade() {
  const videoSections = document.querySelectorAll('[data-video-section]');

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      const overlay = entry.target.querySelector('.video-overlay');
      if (!overlay) return;

      if (entry.isIntersecting) {
        const ratio = entry.intersectionRatio;
        // A más visible la sección, más transparente el overlay
        overlay.style.opacity = String(Math.max(0.3, 1 - ratio * 0.7));
      }
    });
  }, {
    threshold: Array.from({ length: 11 }, (_, i) => i / 10)
  });

  videoSections.forEach(s => observer.observe(s));
}

/* ─── 8. ICON ENTRANCE STAGGER ─────────────────────────── */
function setupIconStagger() {
  const featCards = document.querySelectorAll('.feat-card');
  if (!featCards.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        const index = Array.from(featCards).indexOf(entry.target);
        entry.target.style.transitionDelay = `${index * 40}ms`;
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.15 });

  featCards.forEach(card => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(20px)';
    card.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(card);
  });

  // CSS class para activar
  const style = document.createElement('style');
  style.textContent = '.feat-card.visible { opacity: 1 !important; transform: translateY(0) !important; }';
  document.head.appendChild(style);
}

/* ─── 9. COUNTER ANIMATION ──────────────────────────────── */
function setupCounters() {
  const counters = [
    { id: 'cnt-15k', target: 15000, suffix: 'K+', divisor: 1000, decimals: 0 },
    { id: 'cnt-94',  target: 94,    suffix: '%',  divisor: 1,    decimals: 0 },
    { id: 'cnt-13',  target: 13,    suffix: '',   divisor: 1,    decimals: 0 },
    { id: 'cnt-4',   target: 4,     suffix: '',   divisor: 1,    decimals: 0 },
  ];

  counters.forEach(({ id, target, suffix, divisor, decimals }) => {
    const el = document.getElementById(id);
    if (!el) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        observer.unobserve(entry.target);

        if (REDUCED_MOTION) {
          el.textContent = `${(target / divisor).toFixed(decimals)}${suffix}`;
          return;
        }

        let start = 0;
        const duration = 1600;
        const startTime = performance.now();

        function step(now) {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // easeOutExpo
          const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
          const current = Math.floor(eased * target);
          const display = divisor > 1
            ? `${(current / divisor).toFixed(decimals)}${suffix}`
            : `${current}${suffix}`;
          el.textContent = display;
          if (progress < 1) requestAnimationFrame(step);
        }

        requestAnimationFrame(step);
      });
    }, { threshold: 0.5 });

    observer.observe(el);
  });
}

/* ─── 10. MAIN SCROLL LOOP ──────────────────────────────── */
let heroBgManager, chapterBgManager, neuralGlobeManager;

function initScrollEngine() {
  // Video managers — parallax solo en videos (GPU-composited, no afectan layout)
  heroBgManager     = new VideoBackgroundManager('video-hero-bg',    { sectionId: 'inicio', parallaxFactor: 0.15 });
  chapterBgManager  = new VideoBackgroundManager('video-chapter-bg', { sectionId: 'funciones', parallaxFactor: 0.12 });
  neuralGlobeManager = new VideoBackgroundManager('video-neural',    { sectionId: 'nosotros', parallaxFactor: 0.10 });

  // NOTA: blob parallax gestionado por GSAP ScrollTrigger (inline en index.html, sección 4).
  // El RAF loop aquí solo mueve los videos (GPU-composited, nativo). No mezclar con blobs.

  // Scroll seek para CTA final
  setupScrollVideoSeek('video-justice', 'cta-section');

  // Resto de setups
  setupScrollProgressBar();
  setupChapterNumbers();
  setupVideoOverlayFade();
  setupIconStagger();
  setupCounters();

  // Cursor trail desactivado — causaba un segundo loop RAF concurrente que generaba jank
  // Si se quiere reactivar, usar una versión throttled con IntersectionObserver

  // Main RAF loop — solo video parallax (sin blobs ni hero-content)
  if (!REDUCED_MOTION) {
    let lastScrollY = -1;
    let rafId;

    function update() {
      const scrollY = window.scrollY;

      if (scrollY !== lastScrollY) {
        lastScrollY = scrollY;
        // Solo parallax de videos — son elementos separados en stacking context GPU
        heroBgManager.applyParallax(scrollY);
        chapterBgManager.applyParallax(scrollY);
        neuralGlobeManager.applyParallax(scrollY);
      }

      rafId = requestAnimationFrame(update);
    }
    rafId = requestAnimationFrame(update);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(rafId);
      else {
        lastScrollY = -1;
        rafId = requestAnimationFrame(update);
      }
    });
  }
}

/* ─── INIT ──────────────────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initScrollEngine);
} else {
  initScrollEngine();
}

export { VideoBackgroundManager, ParallaxLayer, setupCounters };
