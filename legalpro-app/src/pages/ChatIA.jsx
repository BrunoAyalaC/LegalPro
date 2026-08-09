import { useState, useRef, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';
import { useSearchParams, Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import AppIcon from '../components/AppIcon';
import IADisclaimerBanner from '../components/IADisclaimerBanner';
import SpriteIcon from '../components/ui/SpriteIcon';
import TarjetaRespuesta from '../components/chat/TarjetaRespuesta';
import { api, nodeClient, detectarDocumento, redactarDocumento } from '../api/client';
import { useSeo } from '../hooks/useSeo';
import avatarIA from '../assets/avatar/avatar_ia.jpeg';
import chatVacioImg from '../assets/empty-states/chat_ia_vacio.png';
import { getProviderLabel } from '../lib/iaProviders.js';

const MAX_STORED = 100;
const DISCLAIMER_KEY = 'legalpro_chat_disclaimer_dismissed';

const QUICK_ACTIONS = [
  { icon: 'summarize', label: 'Resumir caso', prompt: 'Resume los hechos principales de mi expediente activo más urgente.' },
  { icon: 'find_in_page', label: 'Jurisprudencia', prompt: 'Busca jurisprudencia relevante en materia penal sobre delitos contra el patrimonio.' },
  { icon: 'edit_note', label: 'Redactar', prompt: 'Necesito redactar una demanda de alimentos.' },
  { icon: 'schedule', label: 'Plazos', prompt: '¿Qué plazos procesales debo considerar para una apelación en un proceso civil?' },
  { icon: 'trending_up', label: 'Predicción', prompt: 'Predice el resultado probable de un caso de colusión agravada.' },
  { icon: 'psychology', label: 'Estrategia', prompt: 'Genera una estrategia de defensa para un caso de despido arbitrario.' },
];

function chatErrorMessage(err) {
  const status = err?.response?.status;
  const msg = err?.response?.data?.error || err?.response?.data?.message;
  if (status === 403 && err?.response?.data?.code === 'TRANSFERENCIA_INTERNACIONAL_REQUIRED') {
    return 'Debes aceptar la transferencia internacional de datos (LPDP Art. 21) en tu perfil para usar el chat IA.';
  }
  if (status === 402) return msg || 'Créditos insuficientes. Recarga gemas en Mis Créditos.';
  if (status === 400) return msg || 'Solicitud inválida. Revisa el mensaje e intenta de nuevo.';
  if (status === 429) return 'Demasiadas solicitudes. Espera un momento e intenta otra vez.';
  if (msg && /column .* does not exist|relation .* does not exist/i.test(msg)) {
    return 'Error temporal del servidor. El equipo está aplicando una corrección — intenta en 1 minuto.';
  }
  if (!err?.response && /network|failed|fetch/i.test(String(err?.message || ''))) {
    return 'Sin conexión con el servidor. Verifica tu internet e intenta de nuevo.';
  }
  return msg || 'Error al conectar con LexIA. Verifica tu conexión e intenta de nuevo.';
}

function formatAiMessage(text) {
  if (!text) return '';
  let t = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  t = t.replace(/^#{1,6}\s+(.+)$/gm, '<div class="text-cyan-300 font-bold text-sm mt-3 mb-1">$1</div>');
  t = t.replace(/^\s*(\d+)\.\s+\*\*(.+?)\*\*/gm, '<div class="mt-2 mb-0.5 text-sm"><span class="text-cyan-400 font-bold">$1.</span> <strong class="text-cyan-200">$2</strong></div>');
  t = t.replace(/^\s*(\d+)\.\s+(.+)$/gm, '<span class="block ml-1 pl-2 border-l-2 border-cyan-500/20 my-1 text-slate-300"><span class="text-cyan-400 font-semibold mr-1">$1.</span>$2</span>');
  t = t.replace(/\*\*(.+?)\*\*/g, '<strong class="text-cyan-200 font-semibold">$1</strong>');
  t = t.replace(/^\s*[-*]\s+(.+)$/gm, '<span class="block ml-3 pl-1 text-slate-300 my-0.5">• $1</span>');
  t = t.replace(/\n/g, '<br/>');
  return t;
}

export default function ChatIA() {
  const [searchParams] = useSearchParams();
  const expedienteId = searchParams.get('expediente_id');
  const storageKey = expedienteId
    ? `legalpro_chat_messages_${expedienteId}`
    : 'legalpro_chat_messages';

  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [expandidosLeyes, setExpandidosLeyes] = useState({});
  const [showDisclaimer, setShowDisclaimer] = useState(() => {
    try { return !sessionStorage.getItem(DISCLAIMER_KEY); } catch { return true; }
  });

  // ═══ Vincular expediente + generación de documento legal ═══
  const [expedientes, setExpedientes] = useState([]);
  const [expedienteSeleccionado, setExpedienteSeleccionado] = useState(null);
  const [cargandoExpedientes, setCargandoExpedientes] = useState(false);
  const [detectandoDoc, setDetectandoDoc] = useState(false);
  const [descargandoDoc, setDescargandoDoc] = useState(null);
  const [documentoGenerado, setDocumentoGenerado] = useState(null);
  const [errorDoc, setErrorDoc] = useState(null);

  const messagesEnd = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-MAX_STORED)));
    } catch {
      try { localStorage.setItem(storageKey, JSON.stringify(messages.slice(-20))); } catch { /* ignore */ }
    }
  }, [messages, storageKey]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading, documentoGenerado]);

  useSeo({ title: 'Chat LexIA | LegalPro' });

  // Cargar expedientes disponibles para vincular la conversación
  useEffect(() => {
    let active = true;
    setCargandoExpedientes(true);
    nodeClient
      .get('/api/expedientes', { params: { page: 1, pageSize: 200 } })
      .then((res) => {
        if (!active) return;
        const data = res.data?.data ?? res.data;
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.expedientes)
            ? data.expedientes
            : [];
        setExpedientes(items);
        // Si llegamos vía ?expediente_id=..., preseleccionar ese caso
        if (expedienteId && items.some((e) => String(e.id) === String(expedienteId))) {
          setExpedienteSeleccionado(items.find((e) => String(e.id) === String(expedienteId)) ?? null);
        }
      })
      .catch(() => { /* Sin expedientes: el selector muestra la opción vacía */ })
      .finally(() => { if (active) setCargandoExpedientes(false); });
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const dismissDisclaimer = useCallback(() => {
    setShowDisclaimer(false);
    try { sessionStorage.setItem(DISCLAIMER_KEY, '1'); } catch { /* ignore */ }
  }, []);

  const handleClearChat = useCallback(() => {
    if (!window.confirm('¿Limpiar todo el historial del chat? Esta acción no se puede deshacer.')) return;
    setMessages([]);
    setExpandidosLeyes({});
    localStorage.removeItem(storageKey);
  }, [storageKey]);

  const toggleLeyes = useCallback((idx) => {
    setExpandidosLeyes((prev) => ({ ...prev, [idx]: !prev[idx] }));
  }, []);

  const copyMessage = useCallback(async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch { /* ignore */ }
  }, []);

  const handleSend = async (text) => {
    if (loading) return;
    const mensaje = (text ?? input).trim();
    if (!mensaje) return;

    const userMsg = {
      role: 'user',
      text: mensaje,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const historial = messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        text: m.text,
      }));
      const data = await api.chat(mensaje, historial, expedienteId);
      const respuesta = data?.respuesta ?? data?.texto ?? '';
      // Estructura completa para renderizado polimórfico (TarjetaRespuesta.jsx).
      // El backend (server/utils/intentRouter.js + server/routes/ai.js) puede
      // devolver tipo_respuesta ∈ {'plazo','escrito','analisis','jurisprudencia',
      // 'prediccion','respuesta'} con `data` estructurada por tipo.
      const tipoRespuesta = data?.tipo_respuesta ?? data?.tipo_respuesta ?? 'respuesta';
      setMessages((prev) => [...prev, {
        role: 'ai',
        text: respuesta || 'No se recibió respuesta del asistente.',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        leyes: data?.leyes ?? data?.referencias ?? null,
        // Payload crudo para TarjetaRespuesta: contiene tipo_respuesta + data + intencion + tokens.
        raw: data,
        tipoRespuesta,
      }]);
    } catch (err) {
      setMessages((prev) => [...prev, {
        role: 'ai',
        text: chatErrorMessage(err),
        time: 'Error',
        isError: true,
      }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  // ═══ Contexto del expediente vinculado (materia + número legible) ═══
  const materiaContexto = expedienteSeleccionado?.tipo ?? undefined;
  const numeroExpediente = expedienteSeleccionado?.numero ?? undefined;

  // Detecta el tipo de documento a partir de la conversación y habilita la descarga
  const generarDocumento = async () => {
    if (!messages.length || detectandoDoc) return;
    setDetectandoDoc(true);
    setErrorDoc(null);
    setDocumentoGenerado(null);
    try {
      const conversacion = messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        text: m.text,
      }));
      // La función centralizada SIEMPRE envía disclaimerAceptado: true
      // (el backend responde 403 DISCLAIMER_REQUIRED si falta — LPDP).
      const det = await detectarDocumento(conversacion, materiaContexto, expedienteId);
      const payload = det.data?.data ?? det.data ?? {};
      const tipo = payload.tipo || 'escrito_simple';
      const titulo = payload.titulo || 'Documento Legal';
      setDocumentoGenerado({ tipo, titulo });
    } catch (err) {
      setErrorDoc('No se pudo detectar el tipo de documento. Intenta de nuevo.');
    } finally {
      setDetectandoDoc(false);
    }
  };

  // Descarga el documento redactado (PDF/DOCX) como buffer desde el backend
  const descargarDocumento = async (formato = 'pdf') => {
    if (!documentoGenerado || descargandoDoc) return;
    setDescargandoDoc(formato);
    setErrorDoc(null);
    try {
      const conversacion = messages.map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        text: m.text,
      }));
      // La función centralizada SIEMPRE envía disclaimerAceptado: true
      // (el backend responde 403 DISCLAIMER_REQUIRED si falta — LPDP)
      // y devuelve la respuesta Axios completa (data = Blob + headers).
      const resp = await redactarDocumento(
        {
          conversacion,
          tipoDocumento: documentoGenerado.tipo,
          materia: materiaContexto,
          numeroExpediente: numeroExpediente,
        },
        formato
      );
      const cd = resp.headers?.['content-disposition'];
      const match = cd && /filename="?([^";]+)"?/i.exec(cd);
      const ext = formato === 'docx' ? 'docx' : 'pdf';
      const nombre = match?.[1] ?? `${documentoGenerado.tipo}_${Date.now()}.${ext}`;
      const url = URL.createObjectURL(resp.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      let mensaje = 'No se pudo generar el archivo para descarga. Intenta de nuevo.';
      try {
        // Con responseType 'blob' axios envuelve los errores JSON del backend
        // como Blob. Si el servidor respondió content-type application/json
        // (402 créditos, 403 disclaimer, 500 PDF service, etc.) lo parseamos
        // para mostrar el mensaje de error real en lugar del genérico.
        const blob = err?.response?.data;
        const contentType = String(err?.response?.headers?.['content-type'] ?? '');
        if (blob instanceof Blob && contentType.includes('application/json')) {
          const parsed = JSON.parse(await blob.text());
          if (parsed?.error) mensaje = parsed.error;
          else if (parsed?.message) mensaje = parsed.message;
        }
      } catch { /* Respuesta de error no JSON: conservar mensaje genérico */ }
      setErrorDoc(mensaje);
    } finally {
      setDescargandoDoc(null);
    }
  };

  const isEmpty = messages.length === 0;

  return (
    <div
      data-testid="chat-shell"
      className="chat-shell flex flex-col flex-1 min-h-0 h-full max-w-4xl mx-auto w-full"
    >
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 sm:px-4 py-2.5 border-b border-white/8 bg-slate-900/70 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shrink-0">
            <SpriteIcon name="chat" size={26} />
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-white truncate">
              Lex<span className="text-cyan-400">IA</span> Chat
            </h1>
            <p className="text-[10px] text-slate-400 truncate">Asistente legal · {getProviderLabel('opencode')}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {messages.length > 0 && (
            <button
              type="button"
              onClick={handleClearChat}
              className="p-2 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
              title="Limpiar chat"
              aria-label="Limpiar chat"
            >
              <AppIcon name="delete_sweep" size={18} />
            </button>
          )}
          <span className="hidden sm:inline-flex badge badge-primary text-[10px]">
            <AppIcon name="auto_awesome" size={14} /> {getProviderLabel('opencode')}
          </span>
        </div>
      </div>

      {showDisclaimer ? (
        <IADisclaimerBanner compact className="mx-3 sm:mx-4 mt-2 shrink-0" onDismiss={dismissDisclaimer} />
      ) : (
        <button
          type="button"
          onClick={() => setShowDisclaimer(true)}
          className="mx-3 sm:mx-4 mt-2 shrink-0 self-start text-[10px] text-amber-400/80 hover:text-amber-300 flex items-center gap-1"
        >
          <AppIcon name="warning" size={12} /> Aviso legal IA
        </button>
      )}

      <div className="shrink-0 flex flex-col sm:flex-row sm:items-center gap-2 px-3 sm:px-4 py-2 border-b border-white/5 bg-slate-900/40">
        <label
          htmlFor="chat-expediente-select"
          className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-400 font-semibold shrink-0"
        >
          <AppIcon name="folder_open" size={12} aria-hidden="true" />
          Vincular a expediente
        </label>
        <select
          id="chat-expediente-select"
          data-testid="chat-expediente-select"
          value={expedienteSeleccionado?.id ?? ''}
          onChange={(e) => {
            const id = e.target.value || null;
            const sel = expedientes.find((x) => String(x.id) === String(id)) ?? null;
            setExpedienteSeleccionado(sel);
            setDocumentoGenerado(null);
            setErrorDoc(null);
          }}
          disabled={cargandoExpedientes}
          className="w-full sm:max-w-xs text-xs bg-slate-800/80 border border-white/10 rounded-lg px-2.5 py-1.5 text-white outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/10 disabled:opacity-50"
        >
          <option value="">
            {cargandoExpedientes ? 'Cargando expedientes…' : 'Sin caso vinculado'}
          </option>
          {expedientes.map((exp) => (
            <option key={exp.id} value={exp.id}>
              {exp.numero || 'S/N'} — {exp.titulo || exp.tipo || 'Sin materia'}
            </option>
          ))}
        </select>
      </div>

      <div className="shrink-0 flex flex-wrap sm:flex-nowrap gap-2 px-3 sm:px-4 py-2 overflow-x-auto no-scrollbar border-b border-white/5">
        {QUICK_ACTIONS.map((a) => (
          <button
            key={a.label}
            type="button"
            disabled={loading}
            onClick={() => handleSend(a.prompt)}
            className="shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-[11px] sm:text-xs font-semibold
              bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20
              disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <AppIcon name={a.icon} size={16} />
            {a.label}
          </button>
        ))}
      </div>

      <div
        role="log"
        aria-live="polite"
        aria-label="Historial de conversación con LexIA"
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 sm:px-4 py-3 space-y-4 chat-messages-scroll"
      >
        {isEmpty ? (
          <div className="empty-state flex flex-col items-center justify-center min-h-[40vh] text-center px-4 py-8">
            <img src={chatVacioImg} alt="" loading="lazy" className="w-36 sm:w-44 max-w-full mb-4 opacity-90" />
            <h3 className="text-lg font-bold text-white mb-2">
              Hola, soy <span className="gradient-text">Lex-IA</span>
            </h3>
            <p className="text-sm text-slate-400 max-w-sm mb-6">
              Tu asistente legal con IA. Elige una acción rápida o escribe tu consulta abajo.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {QUICK_ACTIONS.slice(0, 4).map((a) => (
                <button
                  key={a.label}
                  type="button"
                  disabled={loading}
                  onClick={() => handleSend(a.prompt)}
                  className="px-3 py-2 rounded-xl text-xs font-medium bg-white/5 hover:bg-cyan-500/15 text-slate-300 border border-white/10 transition-colors"
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div
              key={`${msg.role}-${msg.time}-${i}`}
              className={`flex gap-2.5 anim-fade-in-up ${
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {msg.role === 'ai' ? (
                <img src={avatarIA} alt="LexIA" loading="lazy" className="ai-avatar w-8 h-8 sm:w-9 sm:h-9 shrink-0 mt-0.5" />
              ) : (
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center shrink-0 mt-0.5 order-2">
                  <AppIcon name="person" size={18} className="text-indigo-200" />
                </div>
              )}
              <div className={`flex flex-col gap-1 min-w-0 ${
                msg.role === 'user'
                  ? 'items-end max-w-[85%] sm:max-w-[75%] order-1'
                  : 'items-start max-w-[88%] sm:max-w-[80%]'
              }`}>
                <div className={`group relative p-3 sm:p-3.5 rounded-2xl break-words ${
                  msg.role === 'user'
                    ? 'chat-user rounded-br-md text-white inline-block max-w-full'
                    : msg.isError
                      ? 'bg-red-500/10 border border-red-500/25 text-red-200 rounded-bl-md w-full'
                      : 'chat-ai rounded-bl-md w-full'
                }`}>
                  {msg.role === 'user' ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                  ) : (
                    <>
                      <TarjetaRespuesta
                        respuesta={msg.raw || { respuesta: msg.text, tipo_respuesta: 'respuesta', data: { leyes: msg.leyes } }}
                        onDownload={async (formato) => {
                          // Disparar descarga de escrito usando el tipo detectado.
                          if (msg.tipoRespuesta !== 'escrito') return;
                          try {
                            setDetectandoDoc(true);
                            const conversacion = messages.map((m) => ({
                              role: m.role === 'user' ? 'user' : 'model',
                              text: m.text,
                            }));
                            const tipoDoc = msg.raw?.data?.tipo || 'escrito_simple';
                            const resp = await redactarDocumento(
                              {
                                conversacion,
                                tipoDocumento: tipoDoc,
                                materia: materiaContexto,
                                numeroExpediente: numeroExpediente,
                              },
                              formato,
                            );
                            const cd = resp.headers?.['content-disposition'];
                            const match = cd && /filename="?([^";]+)"?/i.exec(cd);
                            const ext = formato === 'docx' ? 'docx' : 'pdf';
                            const nombre = match?.[1] ?? `${tipoDoc}_${Date.now()}.${ext}`;
                            const url = URL.createObjectURL(resp.data);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = nombre;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            URL.revokeObjectURL(url);
                          } catch (err) {
                            let mensaje = 'No se pudo generar el archivo para descarga.';
                            try {
                              const blob = err?.response?.data;
                              const ct = String(err?.response?.headers?.['content-type'] ?? '');
                              if (blob instanceof Blob && ct.includes('application/json')) {
                                const parsed = JSON.parse(await blob.text());
                                if (parsed?.error) mensaje = parsed.error;
                                else if (parsed?.message) mensaje = parsed.message;
                              }
                            } catch { /* ignore */ }
                            setErrorDoc(mensaje);
                          } finally {
                            setDetectandoDoc(false);
                          }
                        }}
                      />
                      {/* Si tipo_respuesta === 'respuesta' (o no hay raw), mostramos además el markdown
                          de la burbuja clásica para mantener la experiencia de chat libre. */}
                      {(!msg.raw || msg.tipoRespuesta === 'respuesta' || !msg.tipoRespuesta) && (
                        <div
                          className="chat-ai-content text-sm leading-relaxed text-slate-200"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(formatAiMessage(msg.text), {
                              ALLOWED_TAGS: ['strong', 'br', 'span', 'div', 'p'],
                              ALLOWED_ATTR: ['class'],
                            }),
                          }}
                        />
                      )}
                    </>
                  )}
                  {msg.role === 'ai' && !msg.isError && (
                    <div className="mt-2.5 pt-2 border-t border-white/8 flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-[10px] text-amber-400/70 flex items-center gap-1">
                        <AppIcon name="warning" size={10} />
                        Borrador IA — requiere revisión profesional
                      </p>
                      <button
                        type="button"
                        onClick={() => copyMessage(msg.text)}
                        className="sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 text-[10px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-opacity"
                        aria-label="Copiar respuesta"
                      >
                        <AppIcon name="content_copy" size={12} /> Copiar
                      </button>
                    </div>
                  )}
                  {msg.leyes?.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-white/10">
                      <button
                        type="button"
                        onClick={() => toggleLeyes(i)}
                        className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1"
                      >
                        <AppIcon name="gavel" size={14} />
                        Base legal ({msg.leyes.length})
                        <AppIcon name={expandidosLeyes[i] ? 'expand_less' : 'expand_more'} size={14} />
                      </button>
                      {expandidosLeyes[i] && (
                        <div className="mt-2 pl-2 border-l-2 border-cyan-500/40 space-y-1">
                          {msg.leyes.map((ley, li) => (
                            <p key={li} className="text-[11px] text-slate-400">
                              <span className="text-cyan-400">{ley.norma}</span>
                              {ley.articulos && ` — Art. ${ley.articulos}`}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <span className={`text-[10px] text-slate-500 px-1 ${msg.role === 'user' ? 'text-right' : ''}`}>
                  {msg.time}
                </span>
              </div>
            </div>
          ))
        )}

        {loading && (
          <div className="flex gap-2.5 max-w-[88%]" aria-busy="true" aria-label="LexIA está escribiendo">
            <img src={avatarIA} alt="" className="ai-avatar w-8 h-8 shrink-0" />
            <div className="chat-ai p-3.5 flex items-center gap-2.5 rounded-2xl rounded-bl-md">
              <div className="flex gap-1">
                <div className="typing-dot" />
                <div className="typing-dot" />
                <div className="typing-dot" />
              </div>
              <span className="text-xs text-slate-400">LexIA analizando…</span>
            </div>
          </div>
        )}
        {documentoGenerado && (
          <div className="anim-fade-in-up mt-4 p-4 rounded-lg border border-cyan-500/30 bg-cyan-500/10 max-w-[88%] sm:max-w-[80%]">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-5 h-5 text-cyan-400 shrink-0" aria-hidden="true" />
              <span className="font-semibold text-white text-sm break-words">{documentoGenerado.titulo}</span>
            </div>
            <p className="text-xs text-cyan-200/70 mb-3">
              Documento legal generado con IA. Estructura conforme al Poder Judicial peruano.
            </p>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => descargarDocumento('pdf')}
                disabled={descargandoDoc !== null}
                className="px-3 py-2 rounded-lg bg-cyan-500 text-slate-950 text-sm font-medium hover:bg-cyan-400 disabled:opacity-60 transition-colors"
              >
                {descargandoDoc === 'pdf' ? 'Generando…' : '⬇️ Descargar PDF'}
              </button>
              <button
                type="button"
                onClick={() => descargarDocumento('docx')}
                disabled={descargandoDoc !== null}
                className="px-3 py-2 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-600 disabled:opacity-60 transition-colors"
              >
                {descargandoDoc === 'docx' ? 'Generando…' : '⬇️ Descargar DOCX'}
              </button>
            </div>
          </div>
        )}
        <div ref={messagesEnd} className="h-2 shrink-0" />
      </div>

      <div className="shrink-0 p-3 sm:p-4 border-t border-white/8 bg-slate-900/90 backdrop-blur-xl pb-[max(5.5rem,env(safe-area-inset-bottom))] lg:pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <button
            type="button"
            onClick={generarDocumento}
            disabled={detectandoDoc || !!descargandoDoc || !messages.length}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/20 border border-purple-400/30 text-purple-300 text-sm font-medium hover:bg-purple-500/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="Generar documento legal a partir de la conversación"
          >
            <FileText className="w-4 h-4 shrink-0" aria-hidden="true" />
            {detectandoDoc ? 'Analizando…' : 'Generar Documento'}
          </button>
          {documentoGenerado && (
            <span className="text-[10px] text-cyan-300/70 flex items-center gap-1">
              <AppIcon name="check_circle" size={12} aria-hidden="true" />
              Listo para descargar
            </span>
          )}
        </div>
        {errorDoc && (
          <div
            role="alert"
            className="mb-2 p-3 rounded-lg bg-red-500/10 border border-red-400/30 text-red-300 text-sm"
          >
            {errorDoc}
          </div>
        )}
        <div className="flex items-end gap-2">
          <div className="flex-1 min-w-0 rounded-2xl border border-white/10 bg-slate-800/80 px-3 py-2 flex items-end gap-2 focus-within:border-cyan-500/40 focus-within:ring-2 focus-within:ring-cyan-500/10 transition-all">
            <textarea
              ref={inputRef}
              id="chat-input"
              data-testid="chat-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              disabled={loading}
              rows={1}
              aria-label="Mensaje al asistente legal"
              className="flex-1 min-w-0 max-h-32 bg-transparent border-none outline-none resize-none text-base sm:text-sm text-white placeholder:text-slate-500 disabled:opacity-60 leading-relaxed py-1"
              placeholder="Consulta legal… (Enter envía, Shift+Enter nueva línea)"
            />
          </div>
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            aria-label="Enviar mensaje"
            className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-gradient-to-br from-cyan-500 to-blue-600 text-white flex items-center justify-center shadow-lg shadow-cyan-500/25 disabled:opacity-40 active:scale-95 transition-all"
          >
            <AppIcon name="send" size={20} />
          </button>
        </div>
        {(expedienteSeleccionado || expedienteId) && (
          <p className="text-[10px] text-slate-500 mt-2 text-center">
            Contexto: expediente vinculado ·{' '}
            <Link to="/expedientes" className="text-cyan-400 hover:underline">ver expedientes</Link>
          </p>
        )}
      </div>
    </div>
  );
}
