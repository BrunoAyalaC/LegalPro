import { useState, useEffect, useCallback, useRef } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import { nodeClient } from '../api/client';

/**
 * Bóveda de Evidencia — conectada al backend real.
 *
 * Selector de expedientes: GET /api/expedientes (server/routes/expedientes.js)
 *   Response: { expedientes: [...], total, page, totalPages }
 *
 * Evidencias por expediente: GET /api/boveda/por-expediente/:expedienteId
 *   (server/routes/boveda-chat.js)
 *   Response: { success: true, data: [ { id, hash_sha256, nombre, mime_type,
 *              tamano_bytes, descripcion, cadena_custodia, creado_en, inmutable } ] }
 *   (exige UUID válido en el path → 400 si no)
 *
 * Guardar evidencia: POST /api/boveda/guardar-documento
 *   Body: { expediente_id, nombre?, descripcion?, contenido_base64, mime_type? }
 *   MIME permitidos: pdf, docx, doc, rtf, text/plain, text/markdown.
 */

const EXTENSION_MIME = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  rtf: 'application/rtf',
  txt: 'text/plain',
  md: 'text/markdown',
};

// El backend limita contenido_base64 a 3.000.000 chars (~2,25 MB binario).
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

function formatearBytes(bytes) {
  if (bytes == null || Number.isNaN(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatearFecha(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-PE');
}

function iconoPorMime(mime) {
  if (!mime) return 'description';
  if (mime.startsWith('image/')) return 'image';
  if (mime.startsWith('video/')) return 'videocam';
  return 'description';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      // Quitar el prefijo "data:*;base64," — el backend espera solo el payload base64
      const idx = result.indexOf(',');
      resolve(idx >= 0 ? result.slice(idx + 1) : result);
    };
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(file);
  });
}

export default function BovedaEvidencia() {
  const [expedientes, setExpedientes] = useState([]);
  const [expedienteId, setExpedienteId] = useState('');
  const [evidencias, setEvidencias] = useState([]);
  const [loadingExpedientes, setLoadingExpedientes] = useState(true);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState('');
  const [mensaje, setMensaje] = useState('');
  const fileInputRef = useRef(null);

  const cargarExpedientes = useCallback(async () => {
    setLoadingExpedientes(true);
    setError('');
    try {
      const res = await nodeClient.get('/api/expedientes', { params: { page: 1, pageSize: 100 } });
      // Normalización: { expedientes: [...] } | { data: { expedientes: [...] } } | [...]
      const data = res.data?.data ?? res.data;
      const lista = Array.isArray(data)
        ? data
        : Array.isArray(data?.expedientes)
          ? data.expedientes
          : [];
      setExpedientes(lista);
    } catch {
      setError('No se pudieron cargar los expedientes.');
      setExpedientes([]);
    } finally {
      setLoadingExpedientes(false);
    }
  }, []);

  useEffect(() => {
    cargarExpedientes();
  }, [cargarExpedientes]);

  const cargarEvidencias = useCallback(async (id) => {
    if (!id) {
      setEvidencias([]);
      return;
    }
    setLoadingDocs(true);
    setError('');
    try {
      const res = await nodeClient.get(`/api/boveda/por-expediente/${id}`);
      // Shape real: { success: true, data: [evidencias...] }
      const lista = res.data?.data ?? res.data ?? [];
      setEvidencias(Array.isArray(lista) ? lista : []);
    } catch (err) {
      setError(err?.response?.data?.error || 'No se pudieron cargar las evidencias de la bóveda.');
      setEvidencias([]);
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => {
    if (expedienteId) {
      cargarEvidencias(expedienteId);
    } else {
      setEvidencias([]);
    }
  }, [expedienteId, cargarEvidencias]);

  const subirEvidencia = async (file) => {
    if (!expedienteId) {
      setError('Seleccione un expediente para guardar la evidencia.');
      return;
    }
    const ext = (file.name.split('.').pop() || '').toLowerCase();
    const mime = EXTENSION_MIME[ext];
    if (!mime) {
      setError('Tipo de archivo no soportado. Formatos permitidos: PDF, DOCX, DOC, RTF, TXT, MD.');
      return;
    }
    if (file.size > MAX_BYTES) {
      setError('El archivo supera el límite de 2 MB.');
      return;
    }
    setSubiendo(true);
    setError('');
    setMensaje('');
    try {
      const contenidoBase64 = await fileToBase64(file);
      await nodeClient.post(
        '/api/boveda/guardar-documento',
        {
          expediente_id: expedienteId,
          nombre: file.name,
          descripcion: `Evidencia subida desde Bóveda (${file.type || mime})`,
          contenido_base64: contenidoBase64,
          mime_type: mime,
        },
        { headers: { 'X-Idempotency-Key': crypto.randomUUID() } }
      );
      setMensaje('Evidencia guardada en la bóveda. Hash SHA-256 registrado (Ley 27269).');
      await cargarEvidencias(expedienteId);
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Error al guardar la evidencia.';
      setError(msg);
    } finally {
      setSubiendo(false);
    }
  };

  const verificadas = evidencias.filter((e) => e.inmutable).length;
  const expedienteActual = expedientes.find((e) => String(e.id) === String(expedienteId));
  const etiquetaExpediente = (e) =>
    e.numero || e.numero_expediente || `Expediente ${e.id}`;

  return (
    <div className="page-enter">
      <Header title="Bóveda de Evidencia" showBack rightAction={<AppIcon name="security" size={20} />} />
      <div className="px-4 py-6 space-y-6">
        {/* Selector de expediente */}
        <div className="card p-4 space-y-2">
          <label
            htmlFor="expediente-boveda"
            className="block text-xs font-bold text-slate-400 uppercase tracking-wider"
          >
            Expediente
          </label>
          <select
            id="expediente-boveda"
            value={expedienteId}
            onChange={(e) => setExpedienteId(e.target.value)}
            disabled={loadingExpedientes}
            className="w-full bg-[#14141f] border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-emerald-500/50 disabled:opacity-50"
          >
            <option value="">Seleccione un expediente...</option>
            {expedientes.map((e) => (
              <option key={e.id} value={e.id}>
                {etiquetaExpediente(e)}
                {e.titulo ? ` — ${e.titulo}` : ''}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div role="alert" className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
            {error}
          </div>
        )}
        {mensaje && (
          <div role="status" className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
            {mensaje}
          </div>
        )}

        {!expedienteId ? (
          <div className="card p-10 text-center space-y-2">
            <AppIcon name="security" size={32} className="mx-auto text-slate-500" />
            <p className="text-sm text-slate-400">Seleccione un expediente para ver su bóveda</p>
          </div>
        ) : loadingDocs ? (
          <div className="flex items-center justify-center py-10">
            <div
              className="w-6 h-6 rounded-full border-2 border-emerald-500/30 border-t-emerald-400 animate-spin"
              aria-hidden="true"
            />
            <span className="ml-2 text-xs text-slate-400">Cargando evidencias...</span>
          </div>
        ) : evidencias.length === 0 ? (
          <div className="card p-10 text-center space-y-2">
            <AppIcon name="description" size={32} className="mx-auto text-slate-500" />
            <p className="text-sm text-slate-400">No hay evidencias registradas en la bóveda de este expediente</p>
          </div>
        ) : (
          <>
            <div className="card bg-emerald-500/10 border-emerald-500/20 flex items-center gap-3 p-4">
              <AppIcon name="verified_user" size={20} />
              <div>
                <p className="font-bold text-sm text-emerald-400">Cadena de Custodia Intacta</p>
                <p className="text-xs text-slate-400">
                  {verificadas}/{evidencias.length} evidencias verificadas
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {evidencias.map((e, i) => (
                <div
                  key={e.id}
                  className="card anim-fade-in-up"
                  style={{ animationDelay: `${i * 0.1}s`, opacity: 0 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <AppIcon name={iconoPorMime(e.mime_type)} size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{e.nombre}</p>
                      <p className="text-xs text-slate-400">
                        {formatearBytes(e.tamano_bytes)} • {formatearFecha(e.creado_en)}
                      </p>
                      <p className="text-xs text-slate-500 font-mono mt-1 truncate" title={e.hash_sha256}>
                        SHA-256: {e.hash_sha256}
                      </p>
                    </div>
                    <AppIcon name={e.inmutable ? 'check_circle' : 'pending'} size={20} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.rtf,.txt,.md"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) subirEvidencia(file);
            e.target.value = '';
          }}
          aria-label="Subir archivo de evidencia"
        />
        <button
          className="btn btn-primary w-full"
          disabled={!expedienteId || subiendo}
          onClick={() => fileInputRef.current?.click()}
        >
          <AppIcon name="upload" size={20} />
          {subiendo
            ? 'Guardando evidencia...'
            : expedienteId
              ? 'Agregar Evidencia'
              : 'Seleccione un expediente'}
        </button>
        {expedienteActual && !subiendo && (
          <p className="text-center text-[10px] text-slate-500">
            Bóveda de {etiquetaExpediente(expedienteActual)}
          </p>
        )}
      </div>
    </div>
  );
}
