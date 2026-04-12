import { useState, useEffect, useCallback, startTransition } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, ChevronRight, SkipForward,
  Sparkles, LayoutDashboard, FolderOpen, PenLine,
  Scale, TrendingUp, BookOpen, Bell, Shield,
} from 'lucide-react';
import Button from '../ui/Button';

/* ───────────────────────────────────────────────────────────
   GUÍAS POR ROL
─────────────────────────────────────────────────────────── */
const TOURS = {
  ABOGADO: [
    {
      target: '[data-tour="dashboard"]',
      title: '¡Bienvenido al Dashboard!',
      description:
        'Aquí tienes un resumen de todos tus expedientes, vencimientos próximos y actividad reciente. Todo en un solo vistazo.',
      icon: LayoutDashboard,
      position: 'right',
    },
    {
      target: '[data-tour="expedientes"]',
      title: 'Gestión de Expedientes',
      description:
        'Crea, organiza y gestiona todos tus expedientes judiciales. Cada expediente incluye timeline, documentos, audiencias y análisis IA.',
      icon: FolderOpen,
      position: 'right',
    },
    {
      target: '[data-tour="redactor"]',
      title: 'Redactor de Escritos con IA',
      description:
        'Genera demandas, apelaciones y recursos en segundos con Google Gemini. El asistente conoce el CPC, NCPP y jurisprudencia peruana.',
      icon: PenLine,
      position: 'right',
    },
    {
      target: '[data-tour="simulador"]',
      title: 'Simulador de Juicios',
      description:
        'Practica audiencias virtuales siguiendo el NCPP. La IA actúa como juez, fiscal y testigos para prepararte mejor.',
      icon: Scale,
      position: 'right',
    },
    {
      target: '[data-tour="predictor"]',
      title: 'Predictor Judicial',
      description:
        'Ingresa los datos del caso y obtén probabilidades de éxito basadas en jurisprudencia real del Poder Judicial peruano.',
      icon: TrendingUp,
      position: 'right',
    },
    {
      target: '[data-tour="buscador"]',
      title: 'Buscador de Jurisprudencia',
      description:
        'Busca resoluciones, precedentes vinculantes y sentencias de todos los órganos jurisdiccionales del Perú.',
      icon: BookOpen,
      position: 'right',
    },
    {
      target: '[data-tour="monitor-sinoe"]',
      title: 'Monitor SINOE',
      description:
        'Recibe notificaciones del Sistema de Notificaciones Electrónicas del Poder Judicial en tiempo real. Nunca más un plazo vencido.',
      icon: Bell,
      position: 'right',
    },
    {
      target: '[data-tour="boveda"]',
      title: 'Bóveda de Evidencia Digital',
      description:
        'Almacena documentos, fotos y evidencias de forma segura y encriptada. Control de acceso por expediente.',
      icon: Shield,
      position: 'right',
    },
  ],
  FISCAL: [
    {
      target: '[data-tour="dashboard"]',
      title: '¡Bienvenido, Fiscal!',
      description:
        'Tu dashboard muestra la carga de casos, requerimientos pendientes y estadísticas del Ministerio Público.',
      icon: LayoutDashboard,
      position: 'right',
    },
    {
      target: '[data-tour="expedientes"]',
      title: 'Gestión de Casos Penales',
      description:
        'Administra tus casos penales, denuncias e investigaciones preparatorias desde un solo lugar.',
      icon: FolderOpen,
      position: 'right',
    },
    {
      target: '[data-tour="redactor"]',
      title: 'Redactor de Requerimientos',
      description:
        'El asistente IA te ayuda a redactar requerimientos fiscales, acusaciones y disposiciones conforme al NCPP.',
      icon: PenLine,
      position: 'right',
    },
    {
      target: '[data-tour="predictor"]',
      title: 'Predictor de Sentencias',
      description:
        'Analiza la probabilidad de condena o absolución basándose en precedentes y el perfil del imputado.',
      icon: TrendingUp,
      position: 'right',
    },
  ],
  JUEZ: [
    {
      target: '[data-tour="dashboard"]',
      title: '¡Bienvenido, Magistrado!',
      description:
        'Tu dashboard muestra la carga procesal, expedientes por resolver y métricas de productividad judicial.',
      icon: LayoutDashboard,
      position: 'right',
    },
    {
      target: '[data-tour="expedientes"]',
      title: 'Análisis de Expedientes',
      description:
        'Revisa expedientes con asistencia IA que identifica los puntos controvertidos, pruebas clave y precedentes aplicables.',
      icon: FolderOpen,
      position: 'right',
    },
    {
      target: '[data-tour="buscador"]',
      title: 'Precedentes Vinculantes',
      description:
        'Busca y compara precedentes del TC, Corte Suprema e instancias superiores para fundamentar tus resoluciones.',
      icon: BookOpen,
      position: 'right',
    },
  ],
  CONTADOR: [
    {
      target: '[data-tour="dashboard"]',
      title: '¡Bienvenido, Perito!',
      description:
        'Accede a herramientas de cálculo pericial, liquidaciones y generación de informes técnicos.',
      icon: LayoutDashboard,
      position: 'right',
    },
    {
      target: '[data-tour="herramientas"]',
      title: 'Herramientas Multidisciplinarias',
      description:
        'Calcula liquidaciones laborales, intereses legales, remuneraciones y genera informes periciales completos.',
      icon: Scale,
      position: 'right',
    },
  ],
};

/* ───────────────────────────────────────────────────────────
   UTILIDADES DE POSICIÓN
─────────────────────────────────────────────────────────── */
function getTargetRect(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  if (!el) return null;
  return el.getBoundingClientRect();
}

function computeTooltipStyle(rect, position, tooltipWidth = 320) {
  if (!rect) return { top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };

  const margin = 16;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let style = {};

  if (position === 'right' && rect.right + tooltipWidth + margin < vw) {
    style = {
      top:  Math.max(margin, rect.top + rect.height / 2 - 120),
      left: rect.right + margin,
    };
  } else if (position === 'left' && rect.left - tooltipWidth - margin > 0) {
    style = {
      top:  Math.max(margin, rect.top + rect.height / 2 - 120),
      left: rect.left - tooltipWidth - margin,
    };
  } else if (position === 'bottom') {
    style = {
      top:  rect.bottom + margin,
      left: Math.min(vw - tooltipWidth - margin, Math.max(margin, rect.left + rect.width / 2 - tooltipWidth / 2)),
    };
  } else {
    /* fallback top */
    style = {
      top:  Math.max(margin, rect.top - 260 - margin),
      left: Math.min(vw - tooltipWidth - margin, Math.max(margin, rect.left + rect.width / 2 - tooltipWidth / 2)),
    };
  }

  /* Clamp vertical */
  if (style.top + 260 > vh) style.top = vh - 260 - margin;

  return style;
}

/* ───────────────────────────────────────────────────────────
   COMPONENTE PRINCIPAL
─────────────────────────────────────────────────────────── */
const TOUR_STORAGE_KEY = 'legalpro_tour_completed';

export default function OnboardingTour({ role = 'ABOGADO' }) {
  const steps = TOURS[role] ?? TOURS.ABOGADO;

  /* Estado */
  const [active, setActive]   = useState(false);
  const [step, setStep]       = useState(0);
  const [rects, setRects]     = useState({});

  /* Determinar si el usuario ya completó el tour */
  useEffect(() => {
    try {
      const done = localStorage.getItem(TOUR_STORAGE_KEY);
      if (!done) {
        /* Pequeño delay para que el DOM esté listo */
        const t = setTimeout(() => setActive(true), 1200);
        return () => clearTimeout(t);
      }
    } catch { /* ignore */ }
  }, []);

  /* Recalcular rects cuando cambia el step o el tamaño */
  const recalcRect = useCallback(() => {
    const current = steps[step];
    if (!current) return;
    const rect = getTargetRect(current.target);
    setRects(prev => ({ ...prev, [step]: rect }));
  }, [step, steps]);

  useEffect(() => {
    if (!active) return;
    startTransition(() => recalcRect());

    const onResize = () => recalcRect();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [active, recalcRect]);

  /* Highlight: scroll al target */
  useEffect(() => {
    if (!active) return;
    const current = steps[step];
    if (!current) return;
    const el = document.querySelector(current.target);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      /* Small delay to allow scroll, then recalc */
      const t = setTimeout(recalcRect, 350);
      return () => clearTimeout(t);
    }
  }, [active, step, steps, recalcRect]);

  /* Navegación */
  const finish = useCallback(() => {
    setActive(false);
    try { localStorage.setItem(TOUR_STORAGE_KEY, '1'); } catch { /* ignore */ }
  }, []);

  const skip = useCallback(() => finish(), [finish]);

  const goNext = useCallback(() => {
    if (step < steps.length - 1) {
      setStep(s => s + 1);
    } else {
      finish();
    }
  }, [step, steps.length, finish]);

  const goPrev = useCallback(() => {
    if (step > 0) setStep(s => s - 1);
  }, [step]);

  if (!active) return null;

  const current = steps[step];
  if (!current) return null;

  const rect        = rects[step] ?? null;
  const tooltipStyle = computeTooltipStyle(rect, current.position ?? 'right');
  const Icon        = current.icon ?? Sparkles;

  return createPortal(
    <AnimatePresence>
      {active && (
        <>
          {/* ── Overlay oscuro con spotlight ─── */}
          <motion.div
            key="tour-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[200] pointer-events-none"
            style={{
              background: rect
                ? `radial-gradient(ellipse ${rect.width + 48}px ${rect.height + 48}px at ${
                    rect.left + rect.width / 2
                  }px ${rect.top + rect.height / 2}px, transparent 50%, rgba(0,0,0,0.82) 51%)`
                : 'rgba(0,0,0,0.82)',
            }}
          />

          {/* ── Highlight ring alrededor del target ─── */}
          {rect && (
            <motion.div
              key={`highlight-${step}`}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="fixed z-[201] pointer-events-none rounded-xl"
              style={{
                top:    rect.top    - 6,
                left:   rect.left   - 6,
                width:  rect.width  + 12,
                height: rect.height + 12,
                boxShadow: '0 0 0 2px #3B82F6, 0 0 0 4px rgba(59,130,246,0.3), 0 0 32px rgba(59,130,246,0.4)',
              }}
            >
              {/* Ping ring */}
              <span className="absolute inset-0 rounded-xl animate-ping opacity-20 bg-blue-500" />
            </motion.div>
          )}

          {/* ── Tooltip de instrucción ─── */}
          <motion.div
            key={`tooltip-${step}`}
            initial={{ opacity: 0, scale: 0.92, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -4 }}
            transition={{ duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            className="fixed z-[202] pointer-events-auto"
            style={{ ...tooltipStyle, width: 320 }}
          >
            <div className="backdrop-blur-2xl bg-slate-900/98 border border-white/15
              rounded-2xl shadow-2xl shadow-black/60 overflow-hidden">

              {/* Header degradado */}
              <div className="bg-linear-to-r from-blue-600/20 to-violet-600/10
                border-b border-white/8 px-5 py-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-xl border border-blue-500/30 flex-shrink-0">
                    <Icon size={18} className="text-blue-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white leading-tight">
                    {current.title}
                  </h3>
                </div>
                <button
                  onClick={skip}
                  aria-label="Omitir tour"
                  className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300
                    hover:bg-white/8 transition-colors flex-shrink-0 mt-0.5"
                >
                  <X size={14} />
                </button>
              </div>

              {/* Cuerpo */}
              <div className="px-5 py-4">
                <p className="text-sm text-slate-300 leading-relaxed">
                  {current.description}
                </p>
              </div>

              {/* Footer */}
              <div className="px-5 pb-4 flex items-center justify-between gap-3">
                {/* Dots indicator */}
                <div className="flex gap-1.5">
                  {steps.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setStep(i)}
                      aria-label={`Ir al paso ${i + 1}`}
                      className={`h-1.5 rounded-full transition-all duration-300 cursor-pointer
                        ${i === step ? 'w-5 bg-blue-500' : 'w-1.5 bg-white/25 hover:bg-white/40'}`}
                    />
                  ))}
                </div>

                {/* Controles */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={skip}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors px-2 py-1
                      rounded-lg hover:bg-white/5"
                  >
                    Omitir
                  </button>
                  {step > 0 && (
                    <button
                      onClick={goPrev}
                      aria-label="Paso anterior"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200
                        hover:bg-white/8 transition-colors"
                    >
                      <ChevronLeft size={16} />
                    </button>
                  )}
                  <Button
                    variant={step === steps.length - 1 ? 'gold' : 'primary'}
                    size="sm"
                    onClick={goNext}
                    rightIcon={
                      step === steps.length - 1
                        ? <Sparkles size={13} />
                        : <ChevronRight size={13} />
                    }
                  >
                    {step === steps.length - 1 ? '¡Listo!' : 'Siguiente'}
                  </Button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="h-0.5 bg-white/8">
                <motion.div
                  className="h-full bg-linear-to-r from-blue-500 to-violet-500"
                  initial={false}
                  animate={{ width: `${((step + 1) / steps.length) * 100}%` }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                />
              </div>
            </div>

            {/* Flecha apuntando al target (derecha → flecha izquierda) */}
            {(current.position === 'right') && rect && (
              <div
                className="absolute top-1/2 -left-2 -translate-y-1/2 w-0 h-0"
                style={{
                  borderTop:    '8px solid transparent',
                  borderBottom: '8px solid transparent',
                  borderRight:  '8px solid rgba(15,23,42,0.98)',
                }}
              />
            )}
          </motion.div>

          {/* ── Badge flotante de progreso ─── */}
          <motion.div
            key="progress-badge"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            transition={{ delay: 0.4, duration: 0.3 }}
            className="fixed bottom-6 right-6 z-[202] pointer-events-auto"
          >
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/95 backdrop-blur-xl
              border border-white/10 rounded-full shadow-lg shadow-black/40 text-xs text-slate-400">
              <Sparkles size={12} className="text-blue-400" />
              <span>Tour: <span className="text-white font-semibold">{step + 1}/{steps.length}</span></span>
              <button
                onClick={skip}
                className="ml-1 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <X size={11} />
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}

/* ── Hook para resetear el tour (útil en Settings) ── */
/* eslint-disable-next-line react-refresh/only-export-components */
export function useResetTour() {
  return useCallback(() => {
    try { localStorage.removeItem(TOUR_STORAGE_KEY); } catch { /* ignore */ }
    window.location.reload();
  }, []);
}
