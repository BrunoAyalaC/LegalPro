import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import IADisclaimerBanner from '../components/IADisclaimerBanner';
import IADisclaimerModal from '../components/IADisclaimerModal';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Spinner from '../components/ui/Spinner';
import Badge from '../components/ui/Badge';
import { TIPOS_ESCRITO, MATERIAS } from '../constants';
import { api } from '../api/client';
import { generateLegalPDF, exportToDocx } from '../utils/documents';
import { Copy, Check } from 'lucide-react';
import { useSeo } from '../hooks/useSeo';
import { getProviderLabel } from '../lib/iaProviders.js';

/* ─── Constantes ─────────────────────────────────────────── */
const CHARS_PER_PAGE = 3000;
const MAX_PAGES = 5;
const MAX_CHARS = CHARS_PER_PAGE * MAX_PAGES;

const JUZGADO_SUFIJOS = {
  PENAL:          'Penal',
  CIVIL:          'Civil',
  LABORAL:        'Laboral',
  FAMILIA:        'Familia',
  CONSTITUCIONAL: 'Constitucional',
  ADMINISTRATIVO: 'Administrativo',
  COMERCIAL:      'Comercial',
  TRIBUTARIO:     'Tributario',
};

const MATERIA_COLORS = {
  PENAL:          'red',
  CIVIL:          'blue',
  LABORAL:        'amber',
  FAMILIA:        'pink',
  CONSTITUCIONAL: 'violet',
  ADMINISTRATIVO: 'cyan',
  COMERCIAL:      'emerald',
  TRIBUTARIO:     'orange',
};

/* ─── Helper: estimar páginas ────────────────────────────── */
function estimatePages(text) {
  if (!text || !text.trim()) return 0;
  const clean = text.replace(/\s+/g, ' ').trim();
  return Math.max(1, Math.ceil(clean.length / CHARS_PER_PAGE));
}

/* ─── Helper: ID seguro para claves de storage ────────────── */
// btoa lanza InvalidCharacterError con caracteres fuera de Latin-1
// (comillas «», emoji). Fallback: strip de no-word chars.
const safeId = (s) => {
  try {
    return btoa(unescape(encodeURIComponent(String(s).slice(0, 100))));
  } catch {
    return String(s).slice(0, 50).replace(/\W/g, '');
  }
};

/* ─── Persistencia de revisión — SECURITY/LPDP P1 ─────────── */
// sessionStorage (no localStorage) + TTL 24h con envelope { v, ts, expiresAt,
// data } — mismo patrón que ChatIA.jsx. Los comentarios de revisión y el
// nombre del revisor son PII: expiran solos y mueren con la pestaña.
const REVIEW_TTL_MS = 24 * 60 * 60 * 1000; // 24h

function reviewKey(resultado) {
  return 'legalpro_review_' + safeId(resultado);
}

function loadReviewSafe(key) {
  // Migración legacy: borrar cualquier resto en localStorage (PII sin TTL)
  try {
    if (localStorage.getItem(key)) localStorage.removeItem(key);
  } catch { /* ignore */ }
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Soporte retro: objeto plano sin envelope (formato antiguo)
    if (!parsed || typeof parsed !== 'object' || typeof parsed.expiresAt !== 'number') {
      return typeof parsed === 'object' && parsed !== null ? parsed : null;
    }
    if (Date.now() > parsed.expiresAt) {
      try { sessionStorage.removeItem(key); } catch { /* ignore */ }
      return null;
    }
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

function saveReviewSafe(key, review) {
  try {
    const payload = {
      v: 1,
      ts: Date.now(),
      expiresAt: Date.now() + REVIEW_TTL_MS,
      data: review,
    };
    sessionStorage.setItem(key, JSON.stringify(payload));
  } catch { /* ignore — modo privado / quota */ }
}

/* ─── Helper: construir encabezado legal peruano ─────────── */
function buildLegalHeader({ tipoEscrito, juzgado, numExpediente, sumilla }) {
  const lines = [];
  lines.push(`SEÑOR JUEZ DEL ${juzgado || '[JUZGADO]'}`);
  lines.push('');
  if (numExpediente) {
    lines.push(`EXPEDIENTE N°: ${numExpediente}`);
    lines.push('');
  }
  lines.push(`SUMILLA: ${sumilla || '[SÍNTESIS DEL PEDIDO]'}`);
  lines.push('');
  lines.push('I. PETITORIO');
  lines.push('');
  return lines.join('\n');
}

/* ─── Helper: construir bloque de firmas ─────────────────── */
function buildSignatureBlock({ abogado, recurrente, colegiatura }) {
  const lines = [];
  lines.push('');
  lines.push('________________________');
  lines.push(abogado ? abogado.trim() : '[NOMBRE DEL ABOGADO]');
  lines.push('Abogado patrocinante');
  if (colegiatura) lines.push(`CAL N° ${colegiatura}`);
  lines.push('');
  lines.push('________________________');
  lines.push(recurrente ? recurrente.trim() : '[NOMBRE DEL RECURRENTE]');
  lines.push('Recurrente');
  return lines.join('\n');
}

/* ═══════════════════════════════════════════════════════════ */
/* COMPONENTE PRINCIPAL                                       */
/* ═══════════════════════════════════════════════════════════ */
export default function RedactorEscritos() {
  useSeo({
    title: 'Redactor de Escritos Legales | LegalPro',
    description: 'Redactor de escritos legales con formato legal peruano. Genera demandas, contestaciones, apelaciones, casaciones y más con inteligencia artificial.',
  });

  /* ─── Estado del formulario ────────────────────────────── */
  const [tipoEscrito, setTipoEscrito] = useState('DEMANDA');
  const [materia, setMateria] = useState('CIVIL');
  const [juzgado, setJuzgado] = useState('');
  const [numExpediente, setNumExpediente] = useState('');
  const [recurrente, setRecurrente] = useState('');
  const [abogado, setAbogado] = useState('');
  const [colegiatura, setColegiatura] = useState('');
  const [hechos, setHechos] = useState('');

  /* ─── Estado de generación ─────────────────────────────── */
  const [resultado, setResultado] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportError, setExportError] = useState('');
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const [pendingAction, setPendingAction] = useState(null);
  const [exportLoading, setExportLoading] = useState({ pdf: false, docx: false, copy: false });
  const [copySuccess, setCopySuccess] = useState(false);

  /* ─── Flujo Senior→Junior IA (revisión) ─────────────────── */
  const [reviewStatus, setReviewStatus] = useState('borrador'); // borrador | revisado | rechazado
  const [reviewComment, setReviewComment] = useState('');
  const [revisorNombre, setRevisorNombre] = useState('');

  // Cargar estado de revisión desde sessionStorage (TTL 24h) al generarse un nuevo documento
  useEffect(() => {
    if (resultado) {
      const saved = loadReviewSafe(reviewKey(resultado));
      if (saved) {
        setReviewStatus(saved.status || 'borrador');
        setReviewComment(saved.comment || '');
        setRevisorNombre(saved.revisor || '');
      } else {
        setReviewStatus('borrador');
        setReviewComment('');
      }
    }
  }, [resultado]);

  // ── Cleanup del setTimeout de "copySuccess" para evitar setState tras unmount ──
  const copyTimerRef = useRef(null);
  useEffect(() => {
    return () => {
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Guardar estado de revisión en sessionStorage con TTL 24h (LPDP)
  function saveReview(status, comment = '') {
    setReviewStatus(status);
    setReviewComment(comment);
    if (resultado) {
      saveReviewSafe(reviewKey(resultado), {
        status,
        comment,
        revisor: revisorNombre || 'Abogado Senior',
        fecha: new Date().toISOString(),
      });
    }
  }

  /* ─── Validación de campos ─────────────────────────────── */
  const [touched, setTouched] = useState({});

  const formErrors = {
    juzgado: !juzgado.trim() && touched.juzgado ? 'El juzgado es obligatorio' : '',
    recurrente: !recurrente.trim() && touched.recurrente ? 'El nombre del recurrente es obligatorio' : '',
    abogado: !abogado.trim() && touched.abogado ? 'El nombre del abogado es obligatorio' : '',
    hechos: !hechos.trim() && touched.hechos ? 'Describe los hechos del caso' : '',
  };

  const isFormValid = juzgado.trim() && recurrente.trim() && abogado.trim() && hechos.trim();

  /* ─── Contador de páginas ──────────────────────────────── */
  const estimatedPages = estimatePages(hechos);
  const hechosExceedLimit = hechos.length > MAX_CHARS;
  const pageProgressColor =
    estimatedPages <= 2 ? 'bg-emerald-500' :
    estimatedPages <= 4 ? 'bg-amber-500' :
    'bg-red-500';

  /* ─── Generar escrito ──────────────────────────────────── */
  const handleGenerar = useCallback(async () => {
    if (!isFormValid) {
      setTouched({ juzgado: true, recurrente: true, abogado: true, hechos: true });
      return;
    }

    setLoading(true);
    setError('');
    setResultado('');
    setExportError('');

    try {
      const tipoLabel = TIPOS_ESCRITO.find((t) => t.value === tipoEscrito)?.label || tipoEscrito;
      const materiaLabel = MATERIAS.find((m) => m.value === materia)?.label || materia;

      const sumilla = `Solicito ${tipoLabel.toLowerCase()} en materia ${materiaLabel.toLowerCase()}`;

      const prompt = `Redacta un escrito legal peruano con el siguiente formato EXACTO:

ENCABEZADO:
"SEÑOR JUEZ DEL ${juzgado}"
${numExpediente ? `"EXPEDIENTE N°: ${numExpediente}"` : ''}
"SUMILLA: ${sumilla}"

CUERPO DEL ESCRITO:
- Tipo de escrito: ${tipoLabel}
- Materia: ${materiaLabel}
- Recurrente: ${recurrente}
- Abogado patrocinante: ${abogado}${colegiatura ? `, CAL N° ${colegiatura}` : ''}

Hechos del caso:
${hechos}

REQUISITOS DE FORMALIDAD:
1. Usar lenguaje formal jurídico peruano
2. Incluir fundamentos de derecho segun la materia (${materiaLabel})
3. Citar normas del ordenamiento juridico peruano aplicables
4. Incluir un petitorio (solicitud concreta al juzgado)
5. No exceder 5 páginas
6. Estructura: PETITORIO, FUNDAMENTOS DE HECHO, FUNDAMENTOS DE DERECHO, ANEXOS
7. Incluir al final el juzgado, fecha y firma del abogado`;

      const data = await api.consulta(prompt, 'redaccion');
      const bodyContent = typeof data.resultado === 'string'
        ? data.resultado
        : JSON.stringify(data.resultado, null, 2);

      // Construir documento completo con formato legal peruano
      const docHeader = buildLegalHeader({
        tipoEscrito: tipoLabel,
        juzgado,
        numExpediente,
        sumilla,
      });

      const docFooter = buildSignatureBlock({
        abogado,
        recurrente,
        colegiatura,
      });

      const fullDocument = `${docHeader}\n\n${bodyContent}\n\n${docFooter}`;
      setResultado(fullDocument);
    } catch (err) {
      setError(err?.message || 'Error al conectar con el servidor. Intenta de nuevo.');
    } finally {
      setLoading(false);
    }
  }, [tipoEscrito, materia, juzgado, numExpediente, recurrente, abogado, colegiatura, hechos, isFormValid]);

  /* ─── Exportar DOCX ────────────────────────────────────── */
  const handleExportDocx = useCallback(async () => {
    setExportError('');
    setExportLoading((prev) => ({ ...prev, docx: true }));
    try {
      const tipoLabel = TIPOS_ESCRITO.find((t) => t.value === tipoEscrito)?.label || tipoEscrito;
      const today = new Date().toISOString().split('T')[0];
      const safeTitle = tipoLabel.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]/g, '_');

      await exportToDocx(resultado, `Escrito_${safeTitle}_${today}.docx`, {
        title: tipoLabel,
        author: abogado || 'LegalPro',
        subject: `Escrito legal - ${tipoLabel}`,
      });
    } catch {
      setExportError('Error al generar el archivo DOCX. Intenta de nuevo.');
    } finally {
      setExportLoading((prev) => ({ ...prev, docx: false }));
    }
  }, [resultado, tipoEscrito, abogado]);

  /* ─── Exportar PDF ──────────────────────────────────────── */
  const handleExportPdf = useCallback(async () => {
    setExportError('');
    setExportLoading((prev) => ({ ...prev, pdf: true }));
    try {
      const tipoLabel = TIPOS_ESCRITO.find((t) => t.value === tipoEscrito)?.label || tipoEscrito;
      const today = new Date().toISOString().split('T')[0];
      const safeTitle = tipoLabel.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]/g, '_');

      await generateLegalPDF(resultado, {
        abogado: abogado || 'Abogado',
        colegiatura,
        tipoDocumento: tipoLabel,
        numExpediente,
        organizacion: recurrente || 'Recurrente',
        fecha: new Date().toLocaleDateString('es-PE', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        }),
      });
    } catch {
      setExportError('Error al generar el PDF. Intenta de nuevo.');
    } finally {
      setExportLoading((prev) => ({ ...prev, pdf: false }));
    }
  }, [resultado, tipoEscrito, abogado, colegiatura, numExpediente, recurrente]);

  /* ─── Copiar al portapapeles ───────────────────────────── */
  const handleCopy = useCallback(async () => {
    setExportLoading((prev) => ({ ...prev, copy: true }));
    try {
      await navigator.clipboard.writeText(resultado);
      setCopySuccess(true);
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
      copyTimerRef.current = setTimeout(() => setCopySuccess(false), 2500);
    } catch {
      setExportError('Error al copiar al portapapeles.');
    } finally {
      setExportLoading((prev) => ({ ...prev, copy: false }));
    }
  }, [resultado]);

  /* ─── Confirmar disclaimer y ejecutar acción ───────────── */
  const handleDisclaimerConfirm = useCallback(async () => {
    setShowDisclaimerModal(false);
    setExportError('');

    if (pendingAction === 'docx') {
      await handleExportDocx();
    } else if (pendingAction === 'pdf') {
      await handleExportPdf();
    }
    setPendingAction(null);
  }, [pendingAction, handleExportDocx, handleExportPdf]);

  const handleDisclaimerCancel = useCallback(() => {
    setShowDisclaimerModal(false);
    setPendingAction(null);
  }, []);

  /* ─── Materia actual para colores ──────────────────────── */
  const materiaColor = MATERIA_COLORS[materia] || 'blue';

  /* ═════════════════════════════════════════════════════════ */
  /* RENDER                                                     */
  /* ═════════════════════════════════════════════════════════ */
  return (
    <div className="page-enter">
      <Header
        title="Redactor de Escritos Legales"
        subtitle="Formato legal peruano"
        showBack
        rightAction={
          <Badge variant="ia" className="text-[10px]">
            {getProviderLabel('minimax')}
          </Badge>
        }
      />

      <main className="pb-28">
        {/* ═══ FORMULARIO ═══ */}
        <section className="p-4 space-y-4">
          {/* LPDP: Banner redactor #DC2626 rojo, dismissible=false obligatorio */}
          <IADisclaimerBanner variant="redactor" dismissible={false} compact />
          <div className="backdrop-blur-xl bg-amber-500/8 border border-amber-500/20 rounded-xl p-3 flex items-start gap-3">
            <AppIcon name="info" size={20} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              Complete los datos del caso para generar un escrito con formato legal peruano válido.
              Todos los campos marcados son obligatorios.
            </p>
          </div>

          {/* ── Fila: Tipo de escrito + Materia ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Tipo de escrito */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Tipo de Escrito <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <select
                  className="input appearance-none pr-10 w-full"
                  value={tipoEscrito}
                  onChange={(e) => setTipoEscrito(e.target.value)}
                  aria-label="Tipo de escrito legal"
                >
                  {TIPOS_ESCRITO.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <AppIcon
                  name="description"
                  size={18}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                />
              </div>
            </div>

            {/* Materia */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Materia <span className="text-red-400">*</span>
              </label>
              <div className="relative">
                <select
                  className="input appearance-none pr-10 w-full"
                  value={materia}
                  onChange={(e) => setMateria(e.target.value)}
                  aria-label="Materia legal"
                >
                  {MATERIAS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <AppIcon
                  name="gavel"
                  size={18}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none"
                />
              </div>
            </div>
          </div>

          {/* ── Juzgado ── */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              Juzgado <span className="text-red-400">*</span>
            </label>
            <Input
              placeholder="Ej: Juzgado N° 3 Civil de Lima"
              value={juzgado}
              onChange={(e) => setJuzgado(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, juzgado: true }))}
              error={formErrors.juzgado}
              hint="Formato: Juzgado [N°] [Especialidad] de [Ciudad]"
            />
          </div>

          {/* ── N° de Expediente (opcional) ── */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              N° de Expediente <span className="text-slate-600 font-normal">(opcional)</span>
            </label>
            <Input
              placeholder="Ej: 01234-2025-0-1801-JR-CI-01"
              value={numExpediente}
              onChange={(e) => setNumExpediente(e.target.value)}
            />
          </div>

          {/* ── Fila: Recurrente + Abogado ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Recurrente */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Recurrente (Cliente) <span className="text-red-400">*</span>
              </label>
              <Input
                placeholder="Nombre completo del recurrente"
                value={recurrente}
                onChange={(e) => setRecurrente(e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, recurrente: true }))}
                error={formErrors.recurrente}
              />
            </div>

            {/* Abogado */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Abogado Patrocinante <span className="text-red-400">*</span>
              </label>
              <Input
                placeholder="Nombre del abogado"
                value={abogado}
                onChange={(e) => setAbogado(e.target.value)}
                onBlur={() => setTouched((prev) => ({ ...prev, abogado: true }))}
                error={formErrors.abogado}
              />
            </div>
          </div>

          {/* ── N° de Colegiatura (opcional) ── */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
              N° de Colegiatura <span className="text-slate-600 font-normal">(opcional)</span>
            </label>
            <Input
              placeholder="Ej: 54321"
              value={colegiatura}
              onChange={(e) => setColegiatura(e.target.value)}
            />
          </div>

          {/* ── Hechos del Caso + Contador de páginas ── */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">
                Hechos del Caso <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center gap-2">
                {/* Indicador de páginas */}
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                  <AppIcon name="description" size={14} className="text-slate-500" />
                  <span>
                    ~{estimatedPages} pág{estimatedPages !== 1 ? 's' : ''}
                  </span>
                </div>
                {/* Barra de progreso de páginas */}
                <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${pageProgressColor}`}
                    style={{
                      width: `${Math.min((estimatedPages / MAX_PAGES) * 100, 100)}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <textarea
              className={`input min-h-[120px] resize-y ${
                hechosExceedLimit ? 'border-red-500/50 ring-1 ring-red-500/30' : ''
              }`}
              placeholder="Describa los hechos relevantes del caso de manera clara y cronológica..."
              value={hechos}
              onChange={(e) => setHechos(e.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, hechos: true }))}
              rows={5}
              maxLength={MAX_CHARS + 500}
              aria-label="Hechos del caso"
              aria-invalid={!!formErrors.hechos || hechosExceedLimit}
            />

            <div className="flex items-center justify-between">
              {formErrors.hechos ? (
                <p className="text-[11px] text-red-400">{formErrors.hechos}</p>
              ) : hechosExceedLimit ? (
                <p className="text-[11px] text-red-400">
                  El texto excede el límite de {MAX_PAGES} páginas (~{MAX_CHARS.toLocaleString()} caracteres).
                  Reduce la extensión.
                </p>
              ) : (
                <p className="text-[11px] text-slate-500">
                  Máx. {MAX_PAGES} páginas (~{MAX_CHARS.toLocaleString()} caracteres)
                </p>
              )}
              <span className={`text-[10px] ${hechosExceedLimit ? 'text-red-400' : 'text-slate-500'}`}>
                {hechos.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} caract.
              </span>
            </div>
          </div>

          {/* ── Error de generación ── */}
          {error && (
            <div className="backdrop-blur-xl bg-red-500/10 border border-red-500/30 rounded-xl p-3 flex items-center gap-2">
              <AppIcon name="error" size={18} className="text-red-400 shrink-0" />
              <p className="text-xs text-red-300">{error}</p>
            </div>
          )}

          {/* ── Botón Generar ── */}
          <Button
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleGenerar}
            loading={loading}
            disabled={loading}
          >
            {loading ? 'Generando escrito con IA...' : 'Generar Escrito Legal'}
          </Button>
        </section>

        {/* ═══ RESULTADO ═══ */}
        <section className="px-4 py-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <AppIcon name="edit_note" size={20} />
              Borrador del Escrito
            </h2>
            <Badge variant={materia === 'PENAL' ? 'penal' : materia === 'CIVIL' ? 'civil' : materia === 'LABORAL' ? 'laboral' : 'ia'}>
              {MATERIAS.find((m) => m.value === materia)?.label || materia}
            </Badge>
          </div>

          <div className="card space-y-4 p-5 min-h-[400px]">
            {/* Estado de carga */}
            {loading && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <Spinner size="xl" color="blue" label="Generando escrito..." />
                <div className="text-center space-y-1">
                  <p className="text-sm font-semibold text-slate-300">Generando escrito legal</p>
                  <p className="text-[11px] text-slate-500">
                    Analizando hechos y redactando con formato legal peruano...
                  </p>
                </div>
                {/* Skeleton del documento */}
                <div className="w-full max-w-md space-y-2 mt-2">
                  <div className="h-3 bg-white/8 rounded-full animate-pulse w-3/4 mx-auto" />
                  <div className="h-3 bg-white/8 rounded-full animate-pulse w-1/2 mx-auto" />
                  <div className="h-3 bg-white/8 rounded-full animate-pulse w-full" />
                  <div className="h-3 bg-white/8 rounded-full animate-pulse w-5/6" />
                  <div className="h-3 bg-white/8 rounded-full animate-pulse w-2/3" />
                </div>
              </div>
            )}

            {/* Resultado generado */}
            {!loading && resultado && (
              <>
                <IADisclaimerBanner variant="redactor" dismissible={false} className="mb-2" />

                {/* Badge de páginas */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">
                    Documento generado
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                    <AppIcon name="description" size={12} />
                    ~{estimatePages(resultado)} pág{estimatePages(resultado) !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* Contenido del documento */}
                <div
                  className="bg-slate-950/50 border border-white/5 rounded-xl p-4 sm:p-6 font-serif text-sm leading-relaxed text-slate-200 whitespace-pre-wrap"
                  style={{ fontFamily: "'Times New Roman', Times, serif" }}
                  id="documento-legal"
                  role="document"
                  aria-label="Borrador del escrito legal"
                >
                  {resultado}
                </div>

                {/* ═══ FLUJO SENIOR→JUNIOR: REVISIÓN ═══ */}
                <div className="mt-6 bg-slate-800/50 border border-slate-700/50 rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-2">
                      <AppIcon name="rate_review" size={14} />
                      Revisión Senior
                    </h3>
                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
                      reviewStatus === 'revisado' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                      reviewStatus === 'rechazado' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                      'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        reviewStatus === 'revisado' ? 'bg-emerald-400' :
                        reviewStatus === 'rechazado' ? 'bg-red-400' :
                        'bg-amber-400'
                      }`} />
                      {reviewStatus === 'revisado' ? 'REVISADO Y APROBADO' :
                       reviewStatus === 'rechazado' ? 'RECHAZADO' :
                       'BORRADOR — Pendiente de revisión'}
                    </span>
                  </div>

                  {reviewStatus === 'borrador' && (
                    <div className="space-y-3">
                      <p className="text-xs text-slate-500">
                        Este documento fue generado por IA (junior). Un abogado senior debe revisarlo antes de emitirlo como final.
                      </p>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="Nombre del revisor (opcional)"
                          value={revisorNombre}
                          onChange={e => setRevisorNombre(e.target.value)}
                          className="flex-1 bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                        />
                      </div>
                      <textarea
                        placeholder="Comentarios de revisión (opcional)"
                        value={reviewComment}
                        onChange={e => setReviewComment(e.target.value)}
                        rows={2}
                        className="w-full bg-slate-700/50 border border-slate-600/50 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveReview('revisado', reviewComment)}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center gap-1.5"
                        >
                          <AppIcon name="check" size={14} />
                          Aprobar y Finalizar
                        </button>
                        <button
                          onClick={() => saveReview('rechazado', reviewComment)}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 flex items-center justify-center gap-1.5"
                        >
                          <AppIcon name="close" size={14} />
                          Rechazar — Solicitar Cambios
                        </button>
                      </div>
                    </div>
                  )}

                  {reviewStatus === 'revisado' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-emerald-400 text-sm">
                        <AppIcon name="verified" size={16} />
                        <span className="font-medium">Documento aprobado y finalizado</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        Revisado por: <span className="text-slate-300">{revisorNombre || 'Abogado Senior'}</span>
                      </p>
                      {reviewComment && (
                        <div className="bg-slate-700/30 rounded-lg p-2">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Comentario</p>
                          <p className="text-xs text-slate-300">{reviewComment}</p>
                        </div>
                      )}
                      <button
                        onClick={() => saveReview('borrador', '')}
                        className="text-[11px] text-slate-500 hover:text-slate-300 underline transition-colors"
                      >
                        Volver a borrador
                      </button>
                    </div>
                  )}

                  {reviewStatus === 'rechazado' && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-red-400 text-sm">
                        <AppIcon name="warning" size={16} />
                        <span className="font-medium">Documento rechazado — requiere cambios</span>
                      </div>
                      {reviewComment && (
                        <div className="bg-slate-700/30 rounded-lg p-2">
                          <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Motivo del rechazo</p>
                          <p className="text-xs text-slate-300">{reviewComment}</p>
                        </div>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveReview('borrador', '')}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold transition-all bg-amber-500 hover:bg-amber-400 text-black"
                        >
                          Modificar y Re-enviar a Revisión
                        </button>
                        <button
                          onClick={() => saveReview('revisado', reviewComment)}
                          className="py-2 px-4 rounded-lg text-xs font-semibold transition-all bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                        >
                          Aprobar igual
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Error de exportación */}
                {exportError && (
                  <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                    <AppIcon name="error" size={16} className="text-red-400 shrink-0" />
                    <p className="text-[11px] text-red-300">{exportError}</p>
                  </div>
                )}

                {/* Botones de exportación */}
                <div className="pt-4 flex flex-wrap gap-3 border-t border-white/5">
                  {/* DOCX */}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setPendingAction('docx');
                      setShowDisclaimerModal(true);
                    }}
                    loading={exportLoading.docx}
                    disabled={exportLoading.docx || exportLoading.pdf}
                  >
                    {exportLoading.docx ? 'Generando DOCX...' : 'Descargar DOCX'}
                  </Button>

                  {/* PDF */}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      setPendingAction('pdf');
                      setShowDisclaimerModal(true);
                    }}
                    loading={exportLoading.pdf}
                    disabled={exportLoading.docx || exportLoading.pdf}
                  >
                    {exportLoading.pdf ? 'Generando...' : 'Descargar PDF'}
                  </Button>

                  {/* Copiar */}
                  <Button
                    variant={copySuccess ? 'success' : 'secondary'}
                    size="sm"
                    onClick={handleCopy}
                    disabled={exportLoading.copy}
                    icon={copySuccess ? Check : Copy}
                  >
                    {copySuccess ? '¡Copiado!' : exportLoading.copy ? 'Copiando...' : 'Copiar'}
                  </Button>

                  {/* Contador de páginas dinámico */}
                  <div className="ml-auto flex items-center gap-1.5 text-[10px] text-slate-500">
                    <AppIcon name="description" size={14} />
                    <span>
                      ~{estimatePages(resultado)} pág{estimatePages(resultado) !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Estado vacío */}
            {!loading && !resultado && (
              <div className="h-full flex flex-col items-center justify-center text-center py-16">
                <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mb-4">
                  <AppIcon name="edit_note" size={32} className="text-slate-500" />
                </div>
                <p className="text-sm text-slate-400 mb-1">Complete el formulario y genere el escrito</p>
                <p className="text-[11px] text-slate-500 max-w-xs">
                  El borrador aparecerá aquí con el formato legal peruano, listo para descargar en DOCX o PDF.
                </p>
              </div>
            )}
          </div>
        </section>
      </main>

      {/* ═══ MODAL DE DISCLAIMER LPDP redactor #DC2626 bloqueante ═══ */}
      <IADisclaimerModal
        isOpen={showDisclaimerModal}
        variant="redactor"
        persistent
        actionLabel={pendingAction === 'pdf' ? 'Descargar PDF' : 'Descargar DOCX'}
        onConfirm={handleDisclaimerConfirm}
        onCancel={handleDisclaimerCancel}
      />

      {/* ═══ BOTÓN FLOTANTE DE ACCESO RÁPIDO ═══ */}
      {!resultado && (
        <div className="fixed bottom-24 right-4 z-10">
          <button
            className="bg-primary hover:bg-primary/90 text-white p-4 rounded-full shadow-lg active:scale-95 transition-transform anim-pulse-glow disabled:opacity-40 disabled:anim-pulse-glow"
            onClick={handleGenerar}
            disabled={loading || !isFormValid}
            aria-label="Generar escrito legal"
            title="Generar escrito legal"
          >
            <AppIcon name="auto_awesome" size={22} />
          </button>
        </div>
      )}
    </div>
  );
}
