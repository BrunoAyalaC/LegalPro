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

    if (!this.video) return;
    this._init();
  }

  _init() {
    // En mobile no usamos parallax para preservar performance
    if (IS_MOBILE || REDUCED_MOTION) {
      this.video.parentElement.style.transform = 'none';
      return;
    }

    this.video.addEventListener('canplay', () => {
      this.video.parentElement.style.opacity = '1';
      this.initialized = true;
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
  }

  /** Llamar en cada frame del scroll loop */
  applyParallax(scrollY) {
    if (!this.initialized || REDUCED_MOTION || IS_MOBILE) return;
    if (!this.section) return;

    const rect = this.section.getBoundingClientRect();
    const sectionTop = rect.top + scrollY;
    const offset = (scrollY - sectionTop) * this.parallaxFactor;

    this.video.style.transform = `translateY(${offset}px) scale(1.2)`;
  }
}

/* ─── 2. SCROLL-DRIVEN VIDEO SEEK ──────────────────────── */
/**
 * Controla la reproducción de un video según el scroll
 * Ideal para el justice-reveal.mp4 en el CTA final
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

  let hasStarted = false;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting && !hasStarted) {
        hasStarted = true;
        video.play().catch(() => {});
      }
    });
  }, { threshold: 0.4 });

  observer.observe(section);

  // Scroll seek refinado
  window.addEventListener('scroll', () => {
    const rect = section.getBoundingClientRect();
    const viewH = window.innerHeight;

    if (rect.top < viewH && rect.bottom > 0) {
      const progress = Math.max(0, Math.min(1,
        (viewH - rect.top) / (viewH + rect.height)
      ));
      // Solo seek si el video está pausado (no interferir con autoplay)
      if (video.paused && video.duration) {
        video.currentTime = progress * video.duration;
      }
    }
  }, { passive: true });
}

/* ─── 3. PARALLAX LAYERS ───────────────────────────────── */
class ParallaxLayer {
  /**
   * @param {string} selector — CSS selector del elemento
   * @param {number} speed    — velocidad (0.1 lento - 0.8 rápido)
   * @param {string} axis     — 'Y' (default) | 'X'
   */
  constructor(selector, speed = 0.2, axis = 'Y') {
    this.elements = document.querySelectorAll(selector);
    this.speed = speed;
    this.axis = axis;
  }

  update(scrollY) {
    if (REDUCED_MOTION) return;
    this.elements.forEach(el => {
      const rect = el.getBoundingClientRect();
      const centerY = rect.top + rect.height / 2 - window.innerHeight / 2;
      const offset = centerY * this.speed;
      if (this.axis === 'Y') {
        el.style.transform = `translateY(${offset}px)`;
      } else {
        el.style.transform = `translateX(${offset}px)`;
      }
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
let heroParallax, blobParallax;

function initScrollEngine() {
  // Video managers
  heroBgManager     = new VideoBackgroundManager('video-hero-bg',    { sectionId: 'inicio', parallaxFactor: 0.25 });
  chapterBgManager  = new VideoBackgroundManager('video-chapter-bg', { sectionId: 'funciones', parallaxFactor: 0.2 });
  neuralGlobeManager = new VideoBackgroundManager('video-neural',    { sectionId: 'nosotros', parallaxFactor: 0.15 });

  // Parallax layers
  heroParallax = new ParallaxLayer('.hero-content', 0.12);
  blobParallax = new ParallaxLayer('.blob', 0.08);

  // Scroll seek para CTA final
  setupScrollVideoSeek('video-justice', 'cta-section');

  // Resto de setups
  setupScrollProgressBar();
  setupChapterNumbers();
  setupVideoOverlayFade();
  setupIconStagger();
  setupCounters();

  // Cursor trail (solo desktop)
  if (!IS_MOBILE) new CursorTrail();

  // Main RAF loop para parallax
  if (!REDUCED_MOTION) {
    let rafId;
    function update() {
      const scrollY = window.scrollY;
      heroBgManager.applyParallax(scrollY);
      chapterBgManager.applyParallax(scrollY);
      neuralGlobeManager.applyParallax(scrollY);
      heroParallax.update(scrollY);
      blobParallax.update(scrollY);
      rafId = requestAnimationFrame(update);
    }
    rafId = requestAnimationFrame(update);

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) cancelAnimationFrame(rafId);
      else rafId = requestAnimationFrame(update);
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
