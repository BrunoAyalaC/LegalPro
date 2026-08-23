// legalpro-app/src/pages/GestionMultidoc.jsx
// Pantalla de gestión multi-documento + upload con OCR multimodal.
//
// Flujo:
//   1. Seleccionar expediente.
//   2. Subir archivo (drag & drop o click).
//   3. POST /api/documentos/upload → backend corre Qwen VL → texto_ocr → guarda
//      en expedientes.texto_ocr y registra el documento.
//   4. Preview del texto OCR + hash SHA-256 + créditos restantes.
//   5. Manejo de errores con reintento (403 LPDP, 402 créditos, 503 IA, timeout).
//
// Helper central: api.uploadDocumento() en src/api/client.ts (timeout OCR 90s).
import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload, FileText, AlertTriangle, CheckCircle2, RefreshCw,
  Hash, Coins, FolderOpen, X, Copy, ScanText, Eye, EyeOff,
  Brain, Sparkles, Cpu, Camera,
} from 'lucide-react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import IADisclaimerBanner from '../components/IADisclaimerBanner';
import Spinner from '../components/ui/Spinner';
import TarjetaRespuesta from '../components/chat/TarjetaRespuesta';
import { api, nodeClient, OCR_TIMEOUT_MS, getProviderLabel } from '../api/client';
import { useUI } from '../context/UIContext';
import { useTenant } from '../context/TenantContext';

// Tipos MIME aceptados por el endpoint (alineado con multer + Qwen VL).
const ACCEPTED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/gif',
];
const ACCEPTED_EXT = '.pdf,.png,.jpg,.jpeg,.webp,.gif';
const MAX_FILE_SIZE_MB = 15; // matches multer config en server/routes/documentos.js

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function uploadErrorMessage(err) {
  const status = err?.response?.status;
  const code = err?.response?.data?.code;
  const msg = err?.response?.data?.error || err?.response?.data?.message;
  // Rate-limit / quota excedida (modelos free: Qwen/MiMo/DeepSeek).
  if (status === 429 || code === 'RATE_LIMITED' || /rate[-_ ]?limit/i.test(String(msg || ''))) {
    return 'El proveedor de visión está temporalmente limitado, intentando fallback…';
  }
  if (code === 'INSUFFICIENT_CREDITS' || status === 402) {
    return 'Créditos insuficientes. El OCR cuesta 2 gemas. Recarga en Mis Créditos.';
  }
  if (code === 'IA_NO_DISPONIBLE' || status === 503) {
    return 'El servicio de IA no está disponible en este momento. Por favor reintenta en unos minutos.';
  }
  if (status === 404) {
    return 'El expediente no existe o no pertenece a tu organización.';
  }
  if (status === 401 || status === 403) {
    return msg || 'No autorizado. Verifica tu sesión y vuelve a intentar.';
  }
  if (err?.code === 'ECONNABORTED' || /timeout/i.test(String(err?.message || ''))) {
    return `Tiempo de espera agotado (>${Math.round(OCR_TIMEOUT_MS / 1000)}s). El modelo de visión puede estar lento. Reintenta.`;
  }
  return msg || 'Error al procesar el documento. Reintenta.';
}

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(String(texto || ''));
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Pipeline vision→cerebro (single source of truth para los badges de UI)
// ─────────────────────────────────────────────────────────────────────────────

// IDs alineados con src/lib/iaProviders.js — NO hardcodear textos en los badges.
const VISION_PROVIDER_ID = 'opencode-vision';   // OCR multimodal (Qwen/MiMo)
const CEREBRO_PROVIDER_ID = 'opencode';         // Cerebro (DeepSeek V4 Flash)

// Template del prompt para `api.consulta(prompt, 'analisis', ...)`.
// El placeholder {textoOcr} se rellena en runtime con el texto extraído por OCR.
// Mantener una sola constante para no dispersar el contrato del backend.
function construirPromptAnalisis(textoOcr, nombreDoc) {
  return [
    'Eres LexIA, asistente legal peruano del estudio. Acabas de recibir un documento',
    `(${nombreDoc || 'sin nombre'}) cuyo texto fue extraído por OCR multimodal.`,
    '',
    'Analiza el documento y devuelve un JSON estructurado con esta forma EXACTA:',
    '{',
    '  "tipo_respuesta": "analisis",',
    '  "respuesta": "<resumen ejecutivo en 2-3 oraciones>",',
    '  "data": {',
    '    "resumen": "<resumen del documento>",',
    '    "fortalezas": ["..."],',
    '    "riesgos": ["..."],',
    '    "inconsistencias": ["..."],',
    '    "estrategia": "<estrategia procesal recomendada>"',
    '  }',
    '}',
    '',
    'Citas legales verificadas (TUO, CPC, NCPP, CC, CP según aplique).',
    'Si el OCR es ilegible o vacío, indícalo en el resumen.',
    '',
    '=== TEXTO OCR ===',
    textoOcr || '(sin texto extraído)',
  ].join('\n');
}

// Mensajes de error user-friendly para el análisis IA (cerebro).
function analisisErrorMessage(err) {
  const status = err?.response?.status;
  const code = err?.response?.data?.code;
  const msg = err?.response?.data?.error || err?.response?.data?.message;
  // Rate-limit / quota excedida del proveedor free (DeepSeek, MiMo).
  if (status === 429 || code === 'RATE_LIMITED' || /rate[-_ ]?limit/i.test(String(msg || ''))) {
    return 'El proveedor de visión está temporalmente limitado, intentando fallback…';
  }
  // Modelo no disponible (sin key, caída del upstream).
  if (code === 'IA_NO_DISPONIBLE' || status === 503) {
    return 'El servicio de IA no está disponible en este momento. Intenta de nuevo en unos minutos.';
  }
  if (code === 'INSUFFICIENT_CREDITS' || status === 402) {
    return 'Créditos insuficientes para analizar. Recarga en Mis Créditos.';
  }
  if (status === 401 || status === 403) {
    return msg || 'No autorizado. Verifica tu sesión y vuelve a intentar.';
  }
  if (err?.code === 'ECONNABORTED' || /timeout/i.test(String(err?.message || ''))) {
    return 'Tiempo de espera agotado. El modelo gratuito puede estar saturado. Reintenta.';
  }
  return 'No se pudo analizar. Intenta de nuevo o consulta manualmente.';
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export default function GestionMultidoc() {
  const { toast } = useUI();
  const { organizacion } = useTenant();

  // Estado: datos del expediente y documentos previos
  const [expedientes, setExpedientes] = useState([]);
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState(null);
  const [documentos, setDocumentos] = useState([]);
  const [cargandoExpedientes, setCargandoExpedientes] = useState(false);
  const [cargandoDocumentos, setCargandoDocumentos] = useState(false);

  // Estado: upload OCR
  const [dragActivo, setDragActivo] = useState(false);
  const [archivo, setArchivo] = useState(null); // File pendiente
  const [subiendo, setSubiendo] = useState(false);
  const [progreso, setProgreso] = useState(0); // 0-100, estimado
  const [resultado, setResultado] = useState(null); // { documento, textoOcr }
  const [error, setError] = useState(null);
  const [mostrarPreview, setMostrarPreview] = useState(true);

  // Estado: análisis LexIA (cerebro DeepSeek V4 Flash)
  // analisis shape: { tipo_respuesta: 'analisis', respuesta: string, data: {...} }
  const [analizando, setAnalizando] = useState(false);
  const [analisis, setAnalisis] = useState(null);
  const [analisisError, setAnalisisError] = useState(null);

  const inputRef = useRef(null);

  // Cargar lista de expedientes al montar
  useEffect(() => {
    let active = true;
    setCargandoExpedientes(true);
    nodeClient
      .get('/api/expedientes', { params: { page: 1, pageSize: 200 } })
      .then((res) => {
        if (!active) return;
        const data = res.data?.data ?? res.data;
        const items = Array.isArray(data) ? data : Array.isArray(data?.expedientes) ? data.expedientes : [];
        setExpedientes(items);
      })
      .catch(() => {
        toast?.error?.('No se pudieron cargar los expedientes');
      })
      .finally(() => { if (active) setCargandoExpedientes(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cargar documentos cuando cambia el expediente
  useEffect(() => {
    if (!expedienteSeleccionado?.id) {
      setDocumentos([]);
      return;
    }
    let active = true;
    setCargandoDocumentos(true);
    nodeClient
      .get(`/api/expedientes/${expedienteSeleccionado.id}/documentos`)
      .then((res) => {
        if (!active) return;
        const data = res.data?.data ?? res.data;
        const items = Array.isArray(data) ? data : Array.isArray(data?.documentos) ? data.documentos : [];
        setDocumentos(items);
      })
      .catch(() => {
        // Fallback: el endpoint puede no existir en algunas versiones. Mostrar lista vacía.
        if (active) setDocumentos([]);
      })
      .finally(() => { if (active) setCargandoDocumentos(false); });
    return () => { active = false; };
  }, [expedienteSeleccionado?.id]);

  // Refrescar créditos de la organización tras un upload exitoso
  const refrescarCreditos = useCallback(async () => {
    try {
      const { data } = await nodeClient.get('/api/organizaciones/me');
      const org = data?.data ?? data;
      if (org?.creditosDisponibles != null) {
        // No hay setter local; el Dashboard y PanelCreditos se actualizan por separado.
        // Como mejora opcional se podría pasar un callback desde arriba.
      }
    } catch { /* ignore */ }
  }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const seleccionarArchivo = useCallback((file) => {
    setError(null);
    setResultado(null);
    // Reset análisis previo al cambiar de archivo (no aplica al doc anterior).
    setAnalisis(null);
    setAnalisisError(null);
    if (!file) return;
    if (!ACCEPTED_MIME.includes(file.type) && !file.name.match(/\.(pdf|png|jpg|jpeg|webp|gif)$/i)) {
      setError(`Tipo de archivo no soportado: ${file.type || 'desconocido'}. Use PDF, PNG, JPG o WEBP.`);
      return;
    }
    if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      setError(`Archivo demasiado grande (${formatBytes(file.size)}). Máximo permitido: ${MAX_FILE_SIZE_MB} MB.`);
      return;
    }
    setArchivo(file);
  }, []);

  const handleInputChange = (e) => {
    const file = e.target.files?.[0];
    seleccionarArchivo(file);
    e.target.value = ''; // permitir re-seleccionar el mismo archivo
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActivo(false);
    const file = e.dataTransfer?.files?.[0];
    seleccionarArchivo(file);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActivo(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActivo(false);
  };

  const resetForm = () => {
    setArchivo(null);
    setResultado(null);
    setError(null);
    setProgreso(0);
    // Limpiar también el análisis previo (nuevo doc = nuevo análisis).
    setAnalisis(null);
    setAnalisisError(null);
    setAnalizando(false);
  };

  const ejecutarOCR = async () => {
    if (!archivo || !expedienteSeleccionado?.id || subiendo) return;
    setSubiendo(true);
    setError(null);
    setProgreso(5);
    setResultado(null);

    // Tick visual de progreso mientras corre el modelo (best-effort; axios
    // onUploadProgress solo reporta subida HTTP, no el procesamiento).
    const tickInterval = setInterval(() => {
      setProgreso((p) => Math.min(p + 3, 92));
    }, 1200);

    try {
      const data = await api.uploadDocumento(archivo, expedienteSeleccionado.id, {
        descripcion: `OCR multimodal ${archivo.name}`,
        onUploadProgress: (e) => {
          if (e.total) {
            const pct = Math.round((e.loaded / e.total) * 50); // 0-50% = subida HTTP
            setProgreso((cur) => Math.max(cur, pct));
          }
        },
      });
      setProgreso(100);
      const textoExtraido = data?.textoOcr ?? '';
      // Detección de "imagen sin texto legible": el backend responde 200 OK
      // pero el OCR no extrajo nada (foto borrosa, escaneo en blanco, etc.).
      // El usuario pidió un mensaje claro en este caso.
      if (!textoExtraido.trim()) {
        setError('No se pudo extraer texto. ¿La imagen tiene texto legible?');
        toast?.error?.('No se pudo extraer texto. ¿La imagen tiene texto legible?');
        // NO seteamos `resultado` para no activar la card verde de éxito.
        // El `finally` se encarga del clearInterval + setSubiendo(false).
        return;
      }
      setResultado({
        documento: data?.documento ?? null,
        textoOcr: textoExtraido,
        mensaje: data?.mensaje ?? 'Documento procesado correctamente',
        modelo: data?.documento?.archivo_tamano ? null : null,
      });
      // Refrescar la lista de documentos del expediente
      const listRes = await nodeClient
        .get(`/api/expedientes/${expedienteSeleccionado.id}/documentos`)
        .catch(() => null);
      if (listRes) {
        const items = listRes.data?.data ?? listRes.data;
        const list = Array.isArray(items) ? items : Array.isArray(items?.documentos) ? items.documentos : [];
        if (list.length) setDocumentos(list);
      }
      // Refrescar créditos
      refrescarCreditos();
      toast?.success?.('Documento procesado con OCR ✓');
    } catch (err) {
      setError(uploadErrorMessage(err));
    } finally {
      clearInterval(tickInterval);
      setSubiendo(false);
    }
  };

  // ── Análisis con LexIA (cerebro DeepSeek V4 Flash) ─────────────────────
  // Invoca el cerebro sobre el texto OCR del último documento subido.
  // Pipeline: OCR (vision) → textoOcr → cerebro (analisis).
  const analizarConLexIA = async () => {
    if (analizando || !resultado?.textoOcr || !expedienteSeleccionado?.id) return;
    setAnalizando(true);
    setAnalisisError(null);
    setAnalisis(null);

    const nombreDoc = resultado?.documento?.archivo_nombre || archivo?.name || 'documento';
    const prompt = construirPromptAnalisis(resultado.textoOcr, nombreDoc);

    try {
      // api.consulta(prompt, 'analisis', extras) → nodeClient POST /api/ai/consulta
      // con { prompt, tipo: 'analisis', disclaimerAceptado: true } (ver client.ts:589).
      // El backend enruta al cerebro (DeepSeek V4 Flash) y devuelve `resultado`.
      const data = await api.consulta(prompt, 'analisis', {
        expediente_id: expedienteSeleccionado.id,
        origen: 'ocr-multidoc',
      });

      // El backend puede envolver la respuesta en { success, data, resultado }
      // o devolver el payload directo. Normalizamos ambos casos.
      const payload = data?.data ?? data?.resultado ?? data;
      const respuestaNormalizada = {
        tipo_respuesta: payload?.tipo_respuesta ?? 'analisis',
        respuesta: payload?.respuesta ?? payload?.resumen ?? '',
        data: payload?.data ?? payload,
        intencion: payload?.intencion ?? 'analisis',
        provider: data?.provider ?? payload?.provider ?? CEREBRO_PROVIDER_ID,
      };
      // Sanity check: si el backend devolvió texto plano (no estructurado),
      // lo envolvemos como `data.resumen` para que TarjetaAnalisis lo pinte igual.
      if (!respuestaNormalizada.data?.resumen && respuestaNormalizada.respuesta) {
        respuestaNormalizada.data = {
          ...(respuestaNormalizada.data || {}),
          resumen: respuestaNormalizada.respuesta,
        };
      }
      setAnalisis(respuestaNormalizada);
      toast?.success?.('Análisis completado ✓');
    } catch (err) {
      const msg = analisisErrorMessage(err);
      setAnalisisError(msg);
      toast?.error?.(msg);
    } finally {
      setAnalizando(false);
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="page-enter">
      <Header
        title="Gestión Multidocumento"
        subtitle="Sube y procesa documentos con OCR (Qwen VL → cerebro DeepSeek)"
        showBack
        rightAction={<AppIcon name="folder_copy" size={20} />}
      />

      <div className="px-4 py-6 max-w-4xl mx-auto w-full space-y-6">
        {/* ── Banner de IA Provider ───────────────────────────────────── */}
        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3.5 flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/25 flex items-center justify-center text-cyan-300 shrink-0">
            <ScanText size={18} aria-hidden="true" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold text-white">OCR Multimodal — Pipeline Vision + Texto</p>
            <p className="text-[11px] text-cyan-200/80 leading-relaxed">
              Modelo de visión <span className="font-mono">Qwen VL</span> extrae el texto del documento;
              el resultado se guarda en <code className="px-1 rounded bg-cyan-500/10 text-cyan-200">expedientes.texto_ocr</code>{' '}
              y queda disponible para el Analista IA. Costo: <strong>2 créditos</strong> por documento.
            </p>
          </div>
        </div>

        {/* ── Selector de expediente ───────────────────────────────────── */}
        <section className="card space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
            <FolderOpen size={14} /> 1. Selecciona el expediente
          </h3>
          <select
            id="select-expediente-upload"
            value={expedienteSeleccionado?.id ?? ''}
            onChange={(e) => {
              const id = e.target.value || null;
              const sel = expedientes.find((x) => String(x.id) === String(id)) ?? null;
              setExpedienteSeleccionado(sel);
              resetForm();
            }}
            disabled={cargandoExpedientes}
            className="input w-full bg-transparent"
          >
            <option value="">
              {cargandoExpedientes ? 'Cargando expedientes…' : '— Sin expediente —'}
            </option>
            {expedientes.map((exp) => (
              <option key={exp.id} value={exp.id}>
                {exp.numero || 'S/N'} — {exp.titulo || exp.tipo || 'Sin materia'}
              </option>
            ))}
          </select>
        </section>

        {/* ── Zona de upload ───────────────────────────────────────────── */}
        {expedienteSeleccionado && (
          <section className="card space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Upload size={14} /> 2. Sube el documento
            </h3>

            {!archivo && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    inputRef.current?.click();
                  }
                }}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                aria-label="Zona para subir documento. Click o arrastra y suelta."
                className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer
                            transition-colors outline-none
                            focus-visible:ring-2 focus-visible:ring-cyan-500/40
                            ${dragActivo
                              ? 'border-cyan-400 bg-cyan-500/10'
                              : 'border-white/15 bg-white/3 hover:border-cyan-500/40 hover:bg-cyan-500/5'}`}
              >
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPTED_EXT}
                  onChange={handleInputChange}
                  className="sr-only"
                  aria-label="Selector de archivo"
                />
                <div className="w-14 h-14 mx-auto rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-center text-cyan-300 mb-3">
                  <Upload size={26} aria-hidden="true" />
                </div>
                <p className="text-sm font-bold text-white mb-1">
                  Arrastra un documento o haz click para seleccionar
                </p>
                <p className="text-[11px] text-slate-400">
                  PDF, PNG, JPG o WEBP · máximo {MAX_FILE_SIZE_MB} MB
                </p>
              </div>
            )}

            {/* Archivo seleccionado (preview + acciones) */}
            {archivo && !subiendo && !resultado && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText size={20} aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white truncate">{archivo.name}</p>
                    <p className="text-[11px] text-slate-400">
                      {archivo.type || 'tipo desconocido'} · {formatBytes(archivo.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={resetForm}
                    aria-label="Quitar archivo"
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-slate-400 hover:text-red-400 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={ejecutarOCR}
                    className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-xs font-bold hover:from-cyan-400 hover:to-blue-500 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ScanText size={14} /> Procesar con OCR
                  </button>
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-slate-300 text-xs font-semibold hover:bg-white/10 transition-colors"
                  >
                    Cambiar archivo
                  </button>
                  <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPTED_EXT}
                    onChange={handleInputChange}
                    className="sr-only"
                  />
                </div>
              </div>
            )}

            {/* Estado: subiendo */}
            {subiendo && (
              <div
                role="status"
                aria-live="polite"
                className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4 space-y-3"
              >
                <div className="flex items-center gap-3">
                  <Spinner size="md" color="blue" label="Procesando documento con OCR" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-white">Procesando con OCR multimodal…</p>
                    <p className="text-[11px] text-cyan-200/80 truncate">
                      {archivo?.name} · {formatBytes(archivo?.size || 0)}
                    </p>
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-white/8 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                    style={{ width: `${Math.max(5, Math.min(100, progreso))}%` }}
                  />
                </div>
                <p className="text-[10px] text-cyan-200/70">
                  Subiendo + extrayendo texto con Qwen VL. Esto puede tardar hasta {Math.round(OCR_TIMEOUT_MS / 1000)}s.
                </p>
              </div>
            )}

            {/* Estado: error */}
            {error && (
              <div
                role="alert"
                className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-2"
              >
                <div className="flex items-start gap-2.5">
                  <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-red-200">No se pudo procesar el documento</p>
                    <p className="text-xs text-red-200/80 leading-relaxed">{error}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={ejecutarOCR}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/25 text-red-200 text-xs font-bold hover:bg-red-500/25 transition-colors"
                >
                  <RefreshCw size={13} /> Reintentar
                </button>
              </div>
            )}

            {/* Estado: resultado OK */}
            {resultado && (
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={18} className="text-emerald-400" aria-hidden="true" />
                  <p className="text-sm font-bold text-emerald-200">{resultado.mensaje}</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {resultado.documento?.hash_sha256 && (
                    <div className="rounded-lg bg-black/30 px-3 py-2">
                      <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                        <Hash size={10} /> SHA-256 del archivo
                      </p>
                      <p className="text-[10px] font-mono text-emerald-200/90 break-all leading-snug mt-0.5">
                        {resultado.documento.hash_sha256}
                      </p>
                    </div>
                  )}
                  {resultado.documento && (
                    <div className="rounded-lg bg-black/30 px-3 py-2">
                      <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                        <FileText size={10} /> Documento
                      </p>
                      <p className="text-[11px] text-emerald-200/90 leading-snug mt-0.5">
                        {resultado.documento.archivo_nombre || archivo?.name}
                        {resultado.documento.archivo_tamano && ` · ${formatBytes(resultado.documento.archivo_tamano)}`}
                      </p>
                    </div>
                  )}
                  <div className="rounded-lg bg-black/30 px-3 py-2">
                    <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                      <Coins size={10} /> Costo
                    </p>
                    <p className="text-[11px] text-emerald-200/90 leading-snug mt-0.5">
                      2 créditos debitados (refresca <Link to="/creditos" className="underline">Mis Créditos</Link>)
                    </p>
                  </div>
                  <div className="rounded-lg bg-black/30 px-3 py-2">
                    <p className="text-[9px] uppercase tracking-wider text-slate-400 font-bold flex items-center gap-1">
                      <FolderOpen size={10} /> Expediente
                    </p>
                    <p className="text-[11px] text-emerald-200/90 leading-snug mt-0.5 truncate">
                      {expedienteSeleccionado?.numero} — {expedienteSeleccionado?.titulo}
                    </p>
                  </div>
                </div>

                {/* Preview del texto OCR */}
                {resultado.textoOcr && (
                  <div className="rounded-lg border border-white/10 bg-slate-950/50 overflow-hidden">
                    <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-white/3">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-cyan-300 font-bold flex items-center gap-1 shrink-0">
                          <ScanText size={11} /> Vista previa del texto OCR
                        </p>
                        {/* Badge del provider de visión activo (pipeline vision→cerebro) */}
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/25 text-blue-200 text-[9px] font-bold uppercase tracking-wider"
                          title={`Modelo de visión: ${getProviderLabel(VISION_PROVIDER_ID)} — extrae el texto del documento.`}
                        >
                          <Camera size={9} aria-hidden="true" />
                          OCR: {getProviderLabel(VISION_PROVIDER_ID)}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => copiar(resultado.textoOcr)}
                          className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-cyan-300 transition-colors"
                          aria-label="Copiar texto OCR"
                          title="Copiar"
                        >
                          <Copy size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setMostrarPreview((v) => !v)}
                          className="p-1.5 rounded-md hover:bg-white/10 text-slate-400 hover:text-cyan-300 transition-colors"
                          aria-label={mostrarPreview ? 'Ocultar vista previa' : 'Mostrar vista previa'}
                          title={mostrarPreview ? 'Ocultar' : 'Mostrar'}
                        >
                          {mostrarPreview ? <EyeOff size={12} /> : <Eye size={12} />}
                        </button>
                      </div>
                    </div>
                    {mostrarPreview && (
                      <pre className="p-3 text-[11px] leading-relaxed text-slate-200 whitespace-pre-wrap break-words max-h-80 overflow-y-auto font-mono">
                        {resultado.textoOcr}
                      </pre>
                    )}
                  </div>
                )}

                {/* ── Zona de análisis LexIA (cerebro DeepSeek V4 Flash) ─── */}
                {resultado?.textoOcr && (
                  <div className="space-y-2.5 pt-1">
                    {/* Estado: analizando */}
                    {analizando && (
                      <div
                        role="status"
                        aria-live="polite"
                        className="rounded-xl border border-violet-500/30 bg-violet-500/10 p-4 flex items-center gap-3"
                      >
                        <Spinner size="md" color="violet" label="LexIA analizando documento" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold text-white">LexIA está analizando el documento…</p>
                          <p className="text-[11px] text-violet-200/80 truncate flex items-center gap-1 mt-0.5">
                            <Cpu size={11} aria-hidden="true" />
                            Cerebro: <span className="font-mono">{getProviderLabel(CEREBRO_PROVIDER_ID)}</span>
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Estado: error de análisis */}
                    {analisisError && !analizando && (
                      <div
                        role="alert"
                        className="rounded-xl border border-red-500/30 bg-red-500/10 p-3.5 flex items-start gap-2.5"
                      >
                        <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-red-200">No se pudo analizar el documento</p>
                          <p className="text-[11px] text-red-200/80 leading-relaxed mt-0.5">{analisisError}</p>
                        </div>
                        <button
                          type="button"
                          onClick={analizarConLexIA}
                          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/15 border border-red-500/25 text-red-200 text-[10px] font-bold hover:bg-red-500/25 transition-colors"
                        >
                          <RefreshCw size={11} /> Reintentar
                        </button>
                      </div>
                    )}

                    {/* Estado: análisis OK → tarjeta rica */}
                    {analisis && !analizando && (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-violet-500/15 border border-violet-500/25 text-violet-200 text-[9px] font-bold uppercase tracking-wider"
                            title={`Cerebro: ${getProviderLabel(CEREBRO_PROVIDER_ID)} — análisis jurídico automatizado.`}
                          >
                            <Brain size={9} aria-hidden="true" />
                            Cerebro: {getProviderLabel(CEREBRO_PROVIDER_ID)}
                          </span>
                          <button
                            type="button"
                            onClick={() => copiar(JSON.stringify(analisis?.data ?? analisis, null, 2))}
                            className="text-[10px] inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-white/10 text-slate-400 hover:text-cyan-300 transition-colors"
                            aria-label="Copiar análisis como JSON"
                            title="Copiar análisis (JSON)"
                          >
                            <Copy size={10} /> JSON
                          </button>
                        </div>
                        <TarjetaRespuesta respuesta={analisis} />
                        <p className="text-[10px] text-amber-300/80 flex items-center gap-1 px-1">
                          <Sparkles size={10} aria-hidden="true" />
                          Análisis generado por IA · requiere revisión profesional del abogado.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 text-xs font-semibold hover:bg-white/10 transition-colors flex items-center gap-1.5"
                  >
                    <Upload size={13} /> Subir otro
                  </button>
                  {/* Botón principal: Analizar con LexIA (cerebro) sobre el OCR */}
                  {resultado?.textoOcr && (
                    <button
                      type="button"
                      onClick={analizarConLexIA}
                      disabled={analizando}
                      aria-busy={analizando}
                      className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-600 text-white text-xs font-bold hover:from-violet-400 hover:to-fuchsia-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Brain size={14} aria-hidden="true" />
                      {analisis ? 'Reanalizar con LexIA' : 'Analizar con LexIA'}
                    </button>
                  )}
                  <Link
                    to={`/expediente/${expedienteSeleccionado.id}`}
                    className="px-3 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/25 text-cyan-200 text-xs font-semibold hover:bg-cyan-500/25 transition-colors flex items-center gap-1.5"
                  >
                    <FolderOpen size={13} /> Ver expediente
                  </Link>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ── Lista de documentos previos del expediente ──────────────── */}
        {expedienteSeleccionado && (
          <section className="card space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText size={14} /> 3. Documentos del expediente ({documentos.length})
            </h3>
            {cargandoDocumentos ? (
              <div className="space-y-2">
                {[1, 2].map((i) => (
                  <div key={i} className="h-12 rounded-lg bg-white/5 animate-pulse" />
                ))}
              </div>
            ) : documentos.length === 0 ? (
              <p className="text-xs text-slate-500 py-3 text-center">
                Aún no hay documentos registrados. Sube el primero arriba.
              </p>
            ) : (
              <ul className="divide-y divide-white/5">
                {documentos.map((d, i) => (
                  <li key={d.id ?? i} className="py-2.5 flex items-center gap-3 anim-fade-in-up">
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <AppIcon name="description" size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-200 truncate">
                        {d.archivo_nombre || d.nombre || d.titulo || 'Documento sin título'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        {d.tipo_documento || d.tipo || 'documento'} ·
                        {d.archivo_tamano ? ` ${formatBytes(d.archivo_tamano)} · ` : ' '}
                        {d.created_at ? new Date(d.created_at).toLocaleDateString('es-PE') : ''}
                      </p>
                    </div>
                    {d.hash_sha256 && (
                      <code className="hidden sm:block text-[9px] font-mono text-slate-500 truncate max-w-[120px]" title={d.hash_sha256}>
                        {d.hash_sha256.slice(0, 10)}…
                      </code>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {/* Disclaimer LPDP / IA — banner canónico (regla dura #10, no dismissible) */}
        <IADisclaimerBanner variant="general" dismissible={false} />
      </div>
    </div>
  );
}
