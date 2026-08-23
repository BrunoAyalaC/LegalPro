// legalpro-app/src/components/chat/TarjetaRespuesta.jsx
// Renderizador polimórfico de respuestas del chat según `tipo_respuesta`.
//
// Contrato del backend (server/utils/intentRouter.js + server/routes/ai.js):
//   - respuesta = { respuesta: string, tipo_respuesta, data, intencion, ... }
//   - tipo_respuesta ∈ {'plazo','escrito','analisis','jurisprudencia','prediccion','respuesta'}
//   - `data` es el shape canónico por tool (ver ejecutores en intentRouter.js).
//
// Este componente NO hardcodea nombres de campos: deriva de `data` con fallback
// a `undefined`. Si el backend evoluciona el shape, la UI degrada con elegancia.

import { useState, useMemo } from 'react';
import {
  Scale, FileText, BarChart3, Gavel, TrendingUp,
  ChevronDown, ChevronUp, Download, Copy, AlertTriangle,
  CheckCircle2, XCircle, ExternalLink, Calendar, BookOpen,
  Hash, Sparkles, Clock,
} from 'lucide-react';
import AppIcon from '../AppIcon';
import LegalMarkdown from './LegalMarkdown';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Convierte una fecha ISO o "YYYY-MM-DD" a Date local sin offset de zona. */
function parseLocalDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  // Si es solo YYYY-MM-DD, parseamos manualmente para evitar UTC shift
  const isoMatch = typeof input === 'string' && /^\d{4}-\d{2}-\d{2}/.test(input);
  if (isoMatch) {
    const [y, m, d] = input.slice(0, 10).split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }
  const d = new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

function fmtFecha(input) {
  const d = parseLocalDate(input);
  if (!d) return '—';
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'long', year: 'numeric' });
}

function fmtFechaCorta(input) {
  const d = parseLocalDate(input);
  if (!d) return '—';
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** Color de probabilidad: verde/ámbar/rojo según rango. */
function probabilidadColor(p) {
  if (p == null || Number.isNaN(p)) return 'slate';
  if (p >= 70) return 'emerald';
  if (p >= 40) return 'amber';
  return 'red';
}

/** Trunca un texto a N caracteres con elipsis. */
function trunc(texto, n = 240) {
  const t = String(texto || '').trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1).trimEnd() + '…';
}

/** Normaliza un score/similitud a fracción 0..1 (acepta escala 0-1 o 0-100). */
function normalizarScore(v) {
  if (typeof v !== 'number' || Number.isNaN(v)) return null;
  const n = v > 1 ? v / 100 : v;
  return Math.max(0, Math.min(1, n));
}

/** Chip de color por tribunal de origen (TC / PJ / INDECOPI / otro). */
function claseChipFuente(fuente) {
  const f = String(fuente || '').toLowerCase();
  if (/indeco/.test(f)) return 'bg-orange-500/15 border-orange-500/30 text-orange-300';
  if (/(^|[^a-z])(tc|tribunal\s+constitucional)([^a-z]|$)/.test(f)) return 'bg-purple-500/15 border-purple-500/30 text-purple-300';
  if (/(^|[^a-z])(pj|poder\s+judicial|corte\s+suprema)([^a-z]|$)/.test(f)) return 'bg-cyan-500/15 border-cyan-500/30 text-cyan-300';
  return 'bg-indigo-500/15 border-indigo-500/25 text-indigo-300';
}

/** Copia al portapapeles. */
async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(String(texto || ''));
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta: PLAZO
// ─────────────────────────────────────────────────────────────────────────────

function TarjetaPlazo({ data }) {
  const acto = data?.acto_procesal ?? data?.acto ?? 'Plazo procesal';
  const baseLegal = data?.base_legal ?? null;
  const fechaInicio = data?.fecha_inicio ?? null;
  const fechaVencimiento = data?.fecha_vencimiento ?? null;
  const diasHabiles = data?.dias_habiles ?? null;
  const diasCalendario = data?.dias_calendario ?? data?.dias_calendario_total ?? null;
  const consecuencia = data?.consecuencia ?? data?.consecuencia_vencimiento ?? null;
  const esHabil = data?.es_habil !== false; // default true

  const timeline = useMemo(() => {
    const ini = parseLocalDate(fechaInicio);
    const fin = parseLocalDate(fechaVencimiento);
    if (!ini || !fin) return null;
    return { ini, fin };
  }, [fechaInicio, fechaVencimiento]);

  // Urgencia por días restantes hasta el vencimiento (vs. hoy a medianoche).
  const urgencia = useMemo(() => {
    const fin = parseLocalDate(fechaVencimiento);
    if (!fin) return null;
    const hoy = new Date();
    const hoy0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const dias = Math.round((fin.getTime() - hoy0.getTime()) / 86400000);
    if (dias < 0) return { bd: 'border-red-500/40', badge: 'bg-red-500/15 text-red-300 border border-red-500/40', texto: `⚠ Vencido hace ${Math.abs(dias)}d` };
    if (dias === 0) return { bd: 'border-red-500/40', badge: 'bg-red-500/15 text-red-300 border border-red-500/40', texto: '⚠ Vence hoy' };
    if (dias < 3) return { bd: 'border-red-500/40', badge: 'bg-red-500/15 text-red-300 border border-red-500/40', texto: `⚠ Vence en ${dias}d` };
    if (dias < 7) return { bd: 'border-amber-500/40', badge: 'bg-amber-500/15 text-amber-300 border border-amber-500/40', texto: `Vence en ${dias} días` };
    return { bd: 'border-emerald-500/30', badge: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30', texto: `Vence en ${dias} días` };
  }, [fechaVencimiento]);

  return (
    <div
      role="region"
      aria-label={`Plazo procesal: ${acto}`}
      className={`mt-1 rounded-2xl border ${urgencia ? urgencia.bd : 'border-cyan-500/30'} bg-gradient-to-br from-cyan-500/10 via-cyan-500/5 to-transparent overflow-hidden transition-all duration-200 hover:border-white/20`}
    >
      <div className="px-4 py-3 flex items-start gap-3 border-b border-cyan-500/20 bg-cyan-500/10">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-300">
          <Calendar size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-cyan-300/80 font-bold">Cálculo de plazo procesal</p>
          <h3 className="text-sm font-bold text-white truncate">{acto}</h3>
          {baseLegal && (
            <p className="text-[11px] text-cyan-200/70 mt-0.5 truncate">
              <BookOpen size={10} className="inline mr-1" aria-hidden="true" />
              {baseLegal}
            </p>
          )}
        </div>
      </div>

      <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat icon="schedule" label="Días hábiles" value={diasHabiles != null ? `${diasHabiles}` : '—'} accent="text-cyan-300" />
        <Stat icon="event" label="Inicio" value={fmtFechaCorta(fechaInicio)} />
        <Stat icon="flag" label="Vencimiento" value={fmtFechaCorta(fechaVencimiento)} highlight={!esHabil} />
        {diasCalendario != null && (
          <Stat icon="today" label="Días calendario" value={`${diasCalendario}`} />
        )}
        {data?.plazo_info?.codigo && (
          <Stat icon="gavel" label="Código" value={data.plazo_info.codigo} />
        )}
        {data?.plazo_info?.articulo && (
          <Stat icon="article" label="Artículo" value={String(data.plazo_info.articulo)} />
        )}
      </div>

      {/* Badge countdown de urgencia (visible para AT: fuera del bloque aria-hidden) */}
      {urgencia && (
        <div className={`px-4 ${timeline ? 'pt-3' : 'py-3'}`}>
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${urgencia.badge}`}>
            <Clock size={11} aria-hidden="true" />
            {urgencia.texto}
          </span>
        </div>
      )}

      {/* Mini-timeline CSS */}
      {timeline && (
        <div className="px-4 pb-3" aria-hidden="true">
          <div className="relative h-2 rounded-full bg-white/5 overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-cyan-500/60 to-cyan-300"
              style={{ width: '100%' }}
            />
            <div className="absolute -top-1 left-0 w-4 h-4 rounded-full bg-cyan-400 border-2 border-slate-900 shadow shadow-cyan-400/50" />
            <div className="absolute -top-1 right-0 w-4 h-4 rounded-full bg-emerald-400 border-2 border-slate-900 shadow shadow-emerald-400/50" />
          </div>
          <div className="flex items-center justify-between text-[10px] text-slate-400 mt-1.5">
            <span>{fmtFechaCorta(fechaInicio)}</span>
            <span className="text-emerald-400 font-semibold">Vence: {fmtFechaCorta(fechaVencimiento)}</span>
          </div>
          {!esHabil && (
            <p className="text-[10px] text-amber-300/90 mt-2 flex items-center gap-1">
              <AlertTriangle size={11} aria-hidden="true" />
              Vencimiento en día inhábil: se prorroga al siguiente hábil (CPC art. 144).
            </p>
          )}
        </div>
      )}

      {consecuencia && (
        <div className="mx-4 mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <p className="text-[10px] uppercase tracking-wider text-amber-300/90 font-bold flex items-center gap-1">
            <AlertTriangle size={11} aria-hidden="true" /> Consecuencia del vencimiento
          </p>
          <p className="text-xs text-amber-100/90 mt-1 leading-relaxed">{consecuencia}</p>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, accent = 'text-slate-200', highlight = false }) {
  return (
    <div className={`rounded-xl border ${highlight ? 'border-amber-500/30 bg-amber-500/10' : 'border-white/10 bg-white/5'} px-3 py-2`}>
      <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
        <AppIcon name={icon} size={11} />
        {label}
      </p>
      <p className={`text-sm font-bold ${highlight ? 'text-amber-300' : accent} mt-0.5 truncate`}>{value}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta: ESCRITO
// ─────────────────────────────────────────────────────────────────────────────

function TarjetaEscrito({ data, onDownload }) {
  const tipo = data?.tipo ?? 'escrito';
  const sumilla = data?.sumilla ?? '';
  const fundamentos = Array.isArray(data?.fundamentos) ? data.fundamentos : [];
  const petitorio = data?.petitorio ?? '';
  const baseLegal = Array.isArray(data?.base_legal) ? data.base_legal : [];
  const formatos = Array.isArray(data?.formato_disponible) ? data.formato_disponible : ['pdf', 'docx'];

  const [abierto, setAbierto] = useState(false);

  return (
    <div
      role="region"
      aria-label={`Escrito legal: ${tipo}`}
      className="mt-1 rounded-2xl border border-violet-500/30 bg-gradient-to-br from-violet-500/10 via-violet-500/5 to-transparent overflow-hidden transition-all duration-200 hover:border-white/20"
    >
      <div className="px-4 py-3 flex items-start gap-3 border-b border-violet-500/20 bg-violet-500/10">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-violet-300">
          <FileText size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-violet-300/80 font-bold">Documento legal</p>
          <h3 className="text-sm font-bold text-white capitalize">{String(tipo).replace(/_/g, ' ')}</h3>
        </div>
      </div>

      {sumilla && (
        <div className="p-4 border-b border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Sumilla</p>
          <p className="text-sm text-slate-200 leading-relaxed">{sumilla}</p>
        </div>
      )}

      {fundamentos.length > 0 && (
        <div className="border-b border-white/5">
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-white/5 transition-colors"
            aria-expanded={abierto}
            aria-controls={`fundamentos-${tipo}`}
          >
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Scale size={13} className="text-violet-300" />
              Fundamentos ({fundamentos.length})
            </span>
            {abierto ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {abierto && (
            <ol id={`fundamentos-${tipo}`} className="px-4 pb-3 space-y-2 list-decimal list-inside text-[12px] text-slate-300 marker:text-violet-400 marker:font-bold">
              {fundamentos.map((f, i) => (
                <li key={i} className="leading-relaxed">{f}</li>
              ))}
            </ol>
          )}
        </div>
      )}

      {petitorio && (
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Petitorio</p>
          <p className="text-xs text-slate-200 leading-relaxed">{petitorio}</p>
        </div>
      )}

      {baseLegal.length > 0 && (
        <div className="px-4 py-3 border-b border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Base legal</p>
          <ul className="text-[11px] text-cyan-200/80 space-y-0.5">
            {baseLegal.map((b, i) => <li key={i}>• {b}</li>)}
          </ul>
        </div>
      )}

      <div className="p-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onDownload?.('pdf')}
          disabled={!formatos.includes('pdf')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500 text-slate-950 text-xs font-bold hover:bg-cyan-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Download size={13} />
          Descargar PDF
        </button>
        <button
          type="button"
          onClick={() => onDownload?.('docx')}
          disabled={!formatos.includes('docx')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-700 text-white text-xs font-bold hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Download size={13} />
          DOCX
        </button>
        <p className="text-[10px] text-slate-500 ml-auto">
          Generado con IA · requiere revisión profesional
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta: ANÁLISIS
// ─────────────────────────────────────────────────────────────────────────────

function TarjetaAnalisis({ data }) {
  const resumen = data?.resumen ?? data?.resumenGeneral ?? null;
  const fortalezas = Array.isArray(data?.fortalezas) ? data.fortalezas : (Array.isArray(data?.hechosClave) ? data.hechosClave : []);
  const riesgos = Array.isArray(data?.riesgos) ? data.riesgos : (Array.isArray(data?.riesgosProcesales) ? data.riesgosProcesales : []);
  const estrategia = data?.estrategia ?? data?.estrategiaRecomendada ?? null;
  const inconsistencias = Array.isArray(data?.inconsistencias) ? data.inconsistencias : [];

  return (
    <div
      role="region"
      aria-label="Análisis de expediente"
      className="mt-1 rounded-2xl border border-blue-500/30 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent overflow-hidden transition-all duration-200 hover:border-white/20"
    >
      <div className="px-4 py-3 flex items-start gap-3 border-b border-blue-500/20 bg-blue-500/10">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-300">
          <BarChart3 size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-blue-300/80 font-bold">Análisis del expediente</p>
          <h3 className="text-sm font-bold text-white">Resumen estratégico</h3>
        </div>
      </div>

      {resumen && (
        <div className="p-4 border-b border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Resumen</p>
          <p className="text-sm text-slate-200 leading-relaxed">{resumen}</p>
        </div>
      )}

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 border-b border-white/5">
        {fortalezas.length > 0 && (
          <BloqueLista
            titulo="Fortalezas"
            icono="check_circle"
            color="emerald"
            items={fortalezas}
          />
        )}
        {riesgos.length > 0 && (
          <BloqueLista
            titulo="Riesgos procesales"
            icono="warning"
            color="amber"
            items={riesgos}
          />
        )}
      </div>

      {inconsistencias.length > 0 && (
        <div className="px-4 py-3 border-b border-white/5">
          <BloqueLista
            titulo="Inconsistencias detectadas"
            icono="error"
            color="red"
            items={inconsistencias}
          />
        </div>
      )}

      {estrategia && (
        <div className="p-4">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1 flex items-center gap-1">
            <Sparkles size={11} className="text-blue-300" /> Estrategia recomendada
          </p>
          <p className="text-sm text-slate-100 leading-relaxed">{estrategia}</p>
        </div>
      )}
    </div>
  );
}

function BloqueLista({ titulo, icono, color, items }) {
  const tones = {
    emerald: { bd: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-300', icon: 'text-emerald-400' },
    amber:   { bd: 'border-amber-500/30',   bg: 'bg-amber-500/10',   text: 'text-amber-300',   icon: 'text-amber-400' },
    red:     { bd: 'border-red-500/30',     bg: 'bg-red-500/10',     text: 'text-red-300',     icon: 'text-red-400' },
  }[color] || { bd: 'border-white/10', bg: 'bg-white/5', text: 'text-slate-300', icon: 'text-slate-400' };

  return (
    <div className={`rounded-xl border ${tones.bd} ${tones.bg} p-3`}>
      <p className={`text-[10px] uppercase tracking-wider ${tones.text} font-bold flex items-center gap-1 mb-2`}>
        <AppIcon name={icono} size={12} />
        {titulo} ({items.length})
      </p>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-[12px] text-slate-200 leading-relaxed flex gap-2">
            <span className={`${tones.icon} shrink-0 mt-0.5`} aria-hidden="true">•</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta: JURISPRUDENCIA
// ─────────────────────────────────────────────────────────────────────────────

function TarjetaJurisprudencia({ data }) {
  const resultados = Array.isArray(data?.resultados) ? data.resultados : [];
  const citaciones = Array.isArray(data?.citaciones) ? data.citaciones : [];
  const chunks = data?.chunks_usados ?? data?.chunks ?? null;
  const disponible = data?.disponible !== false;
  // FIX LOW: no anunciar "citas verificadas" si el RAG respondió degradado
  const ragDegradado = data?.rag_degradado === true;
  const avisoDegradacion = typeof data?.aviso_degradacion === 'string' ? data.aviso_degradacion : null;

  if (!disponible) {
    return (
      <div role="alert" className="mt-1 p-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs">
        ⚠️ El servicio de búsqueda de jurisprudencia (RAG) no está disponible en este momento.
      </div>
    );
  }

  if (resultados.length === 0) {
    return (
      <div role="status" className="mt-1 p-3 rounded-2xl border border-slate-500/30 bg-slate-500/10 text-slate-300 text-xs">
        No se encontraron resultados verificados para esta consulta.
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Resultados de jurisprudencia"
      className="mt-1 rounded-2xl border border-indigo-500/30 bg-gradient-to-br from-indigo-500/10 via-indigo-500/5 to-transparent overflow-hidden transition-all duration-200 hover:border-white/20"
    >
      <div className="px-4 py-3 flex items-center justify-between border-b border-indigo-500/20 bg-indigo-500/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-300">
            <Gavel size={18} aria-hidden="true" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-indigo-300/80 font-bold">Jurisprudencia</p>
            <p className="text-xs font-bold text-white">{resultados.length} resultado{resultados.length === 1 ? '' : 's'}</p>
          </div>
        </div>
        {chunks != null && (
          <span className="text-[10px] text-indigo-200/70 font-mono">
            {chunks} chunks · RAG
          </span>
        )}
      </div>

      <ul className="divide-y divide-white/5">
        {resultados.map((r, i) => {
          const score = normalizarScore(r.score ?? r.similitud);
          return (
            <li key={i} className="p-3 hover:bg-white/5 transition-colors">
              <div className="flex items-start gap-2.5">
                <div className="shrink-0 w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center text-indigo-200 text-[10px] font-bold">
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-bold text-white leading-snug">
                    {r.titulo || r.fuente || 'Resultado sin título'}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-[10px] text-slate-400">
                    {r.fuente && (
                      <span className={`px-1.5 py-0.5 rounded border font-semibold ${claseChipFuente(r.fuente)}`}>
                        {r.fuente}
                      </span>
                    )}
                    {r.materia && <span>· {r.materia}</span>}
                    {r.articulo && <span>· art. {r.articulo}</span>}
                    {r.numero && <span>· {r.numero}</span>}
                  </div>
                  {score != null && (
                    <div className="mt-1.5 flex items-center gap-2" aria-hidden="true">
                      <div className="flex-1 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                          style={{ width: `${Math.round(score * 100)}%` }}
                        />
                      </div>
                      <span className="text-[9px] font-mono text-slate-400 tabular-nums shrink-0">
                        {Math.round(score * 100)}% sim
                      </span>
                    </div>
                  )}
                </div>
                {r.url && (
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-indigo-300 transition-colors"
                    aria-label={`Abrir ${r.titulo || r.fuente || 'fuente'} en nueva pestaña`}
                  >
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {citaciones.length > 0 && resultados.length === 0 && (
        <div className="p-3 text-[11px] text-slate-400">
          {citaciones.slice(0, 6).map((c, i) => <p key={i} className="leading-relaxed">{c}</p>)}
        </div>
      )}

      <div className="px-4 py-2 border-t border-white/5 bg-indigo-500/5">
        {ragDegradado ? (
          <p role="alert" className="text-[10px] text-red-300 flex items-center gap-1">
            <AlertTriangle size={10} aria-hidden="true" />
            {avisoDegradacion || 'Búsqueda RAG degradada · citas SIN verificación completa, confirmar con fuente oficial'}
          </p>
        ) : (
          <p className="text-[10px] text-amber-300/80 flex items-center gap-1">
            <AlertTriangle size={10} aria-hidden="true" />
            Citas verificadas vía RAG · requieren confirmación con el texto completo
          </p>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta: PREDICCIÓN
// ─────────────────────────────────────────────────────────────────────────────

function TarjetaPrediccion({ data }) {
  const p = typeof data?.probabilidad_exito === 'number' ? data.probabilidad_exito : null;
  const veredicto = data?.veredicto ?? data?.veredictoGeneral ?? null;
  const fav = Array.isArray(data?.factores_favorables) ? data.factores_favorables : [];
  const desfav = Array.isArray(data?.factores_desfavorables) ? data.factores_desfavorables : [];
  const recomendacion = data?.recomendacion ?? null;
  const color = probabilidadColor(p);
  const tones = {
    emerald: { bd: 'border-emerald-500/30', bg: 'bg-emerald-500/10', text: 'text-emerald-300', fill: 'bg-emerald-500' },
    amber:   { bd: 'border-amber-500/30',   bg: 'bg-amber-500/10',   text: 'text-amber-300',   fill: 'bg-amber-500' },
    red:     { bd: 'border-red-500/30',     bg: 'bg-red-500/10',     text: 'text-red-300',     fill: 'bg-red-500' },
    slate:   { bd: 'border-slate-500/30',   bg: 'bg-slate-500/10',   text: 'text-slate-300',   fill: 'bg-slate-500' },
  }[color];

  const pct = p != null ? Math.max(0, Math.min(100, Math.round(p))) : 0;

  return (
    <div
      role="region"
      aria-label="Predicción judicial"
      className="mt-1 rounded-2xl border border-fuchsia-500/30 bg-gradient-to-br from-fuchsia-500/10 via-fuchsia-500/5 to-transparent overflow-hidden transition-all duration-200 hover:border-white/20"
    >
      <div className="px-4 py-3 flex items-center gap-3 border-b border-fuchsia-500/20 bg-fuchsia-500/10">
        <div className="w-10 h-10 shrink-0 rounded-xl bg-fuchsia-500/20 border border-fuchsia-500/30 flex items-center justify-center text-fuchsia-300">
          <TrendingUp size={20} aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-wider text-fuchsia-300/80 font-bold">Predicción judicial</p>
          <h3 className="text-sm font-bold text-white">Estimación probabilística</h3>
        </div>
      </div>

      {/* Indicador de probabilidad */}
      <div className="p-4 border-b border-white/5">
        <div className="flex items-center gap-4">
          <div className="relative w-20 h-20 shrink-0">
            <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90" aria-hidden="true">
              <circle cx="18" cy="18" r="15.915" className="fill-none stroke-white/10" strokeWidth="2.5" />
              <circle
                cx="18" cy="18" r="15.915"
                className={`fill-none ${tones.fill.replace('bg-', 'stroke-')} transition-all duration-700`}
                strokeWidth="2.5"
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-lg font-extrabold tabular-nums ${tones.text}`}>{pct}%</span>
              <span className="text-[8px] uppercase tracking-wider text-slate-400 font-bold">éxito</span>
            </div>
          </div>
          {veredicto && (
            <div className="min-w-0 flex-1">
              <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1">Veredicto probable</p>
              <p className="text-xs text-slate-100 leading-relaxed">{veredicto}</p>
            </div>
          )}
        </div>

        {/* Barra de progreso visual grande */}
        <div
          className="mt-3 h-2.5 rounded-full bg-slate-700 overflow-hidden"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Probabilidad de éxito: ${pct}%`}
        >
          <div
            className={`h-full rounded-full ${tones.fill} transition-all duration-700`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {fav.length > 0 && (
          <BloqueLista titulo="A favor" icono="thumb_up" color="emerald" items={fav} />
        )}
        {desfav.length > 0 && (
          <BloqueLista titulo="En contra" icono="thumb_down" color="red" items={desfav} />
        )}
      </div>

      {recomendacion && (
        <div className="p-4 border-t border-white/5">
          <p className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1 flex items-center gap-1">
            <Sparkles size={11} className="text-fuchsia-300" /> Recomendación estratégica
          </p>
          <p className="text-sm text-slate-100 leading-relaxed">{recomendacion}</p>
        </div>
      )}

      <div className="px-4 py-2 border-t border-white/5 bg-fuchsia-500/5">
        <p className="text-[10px] text-amber-300/80 flex items-center gap-1">
          <AlertTriangle size={10} aria-hidden="true" />
          Análisis probabilístico — no constituye certeza legal
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tarjeta: RESPUESTA (fallback - burbuja rica)
// ─────────────────────────────────────────────────────────────────────────────

function TarjetaRespuestaSimple({ data, texto }) {
  const leyes = Array.isArray(data?.leyes) ? data.leyes : (Array.isArray(data?.referencias) ? data.referencias : null);
  return (
    <div className="space-y-2">
      {texto && <LegalMarkdown text={texto} />}
      {leyes && leyes.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-slate-400 hover:text-cyan-300 flex items-center gap-1">
            <BookOpen size={12} /> Base legal ({leyes.length})
          </summary>
          <ul className="mt-2 space-y-1 pl-2 border-l-2 border-cyan-500/30">
            {leyes.map((l, i) => (
              <li key={i} className="text-[11px] text-slate-300">
                <span className="text-cyan-300 font-semibold">{l.norma || l.codigo || 'Norma'}</span>
                {l.articulo && <span> · art. {l.articulo}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal: enruta según tipo_respuesta
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Renderiza la tarjeta adecuada según `respuesta.tipo_respuesta`.
 *
 * Props:
 *   - respuesta: { respuesta, tipo_respuesta, data, intencion, ... }
 *   - onDownload?: (formato: 'pdf' | 'docx') => void   ← solo se llama para tipo 'escrito'
 *   - modoTexto?: 'markdown' | 'plain'                  ← cómo renderizar texto libre
 *   - children?: ReactNode                              ← contenido opcional (footer de la burbuja)
 *
 * Comportamiento por tipo:
 *   plazo          → TarjetaPlazo
 *   escrito        → TarjetaEscrito (con botón Descargar PDF/DOCX si hay onDownload)
 *   analisis       → TarjetaAnalisis
 *   jurisprudencia → TarjetaJurisprudencia
 *   prediccion     → TarjetaPrediccion
 *   respuesta      → burbuja simple con markdown del backend + leyes colapsables
 *   (default)      → burbuja simple (fallback robusto)
 */
export default function TarjetaRespuesta({ respuesta, onDownload, children }) {
  const tipo = respuesta?.tipo_respuesta ?? 'respuesta';
  const data = respuesta?.data ?? null;
  const texto = respuesta?.respuesta ?? respuesta?.texto ?? '';

  switch (tipo) {
    case 'plazo':
      return <TarjetaPlazo data={data} />;
    case 'escrito':
      return <TarjetaEscrito data={data} onDownload={onDownload} />;
    case 'analisis':
      return <TarjetaAnalisis data={data} />;
    case 'jurisprudencia':
      return <TarjetaJurisprudencia data={data} />;
    case 'prediccion':
      return <TarjetaPrediccion data={data} />;
    case 'respuesta':
    default:
      return (
        <>
          <TarjetaRespuestaSimple data={data} texto={texto} />
          {children}
        </>
      );
  }
}

// Exportación nombrada para tests / extensión
export { TarjetaPlazo, TarjetaEscrito, TarjetaAnalisis, TarjetaJurisprudencia, TarjetaPrediccion, TarjetaRespuestaSimple };
