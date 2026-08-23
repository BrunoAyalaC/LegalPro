/**
 * AIAssistantPanel — Panel embebido del asistente IA (DeepSeek V4 Flash vía OpenCode Go).
 * Features: chat mini, últimas consultas, typewriter en respuesta, CTA a chat completo.
 * FIX LPDP-2: muestra badge del proveedor IA activo en el header y por mensaje.
 * Sintaxis moderna: motion/react animate con spring
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Send, Loader2, ChevronRight,
  RefreshCw, Copy, Check, MessageSquare,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import CitacionesPanel from './CitacionesPanel';
import RAGStatus from './RAGStatus';
import ProviderBadge from './ProviderBadge';
import { getProviderLabel } from '../../lib/iaProviders.js';

/* ── Proveedor IA por defecto (FIX LPDP-2, Art. 21 LPDP) ───
   OPENCODE-FIRST: DeepSeek V4 Flash vía OpenCode Go es el proveedor
   principal. El mapeo completo de proveedores vive centralizado en
   src/lib/iaProviders.js (single source of truth). */
const DEFAULT_PROVIDER = 'opencode';

/* ── Hook typewriter ─────────────────────────────────────── */
function useTypewriter(text, speed = 18) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    if (!text) { setDisplayed(''); return; }
    setDisplayed('');
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setDisplayed(text.slice(0, i));
      if (i >= text.length) clearInterval(interval);
    }, speed);
    return () => clearInterval(interval);
  }, [text, speed]);
  return displayed;
}

/**
 * @param {object} props
 * @param {object}   [props.expediente]   — contexto del caso actual
 * @param {string}   [props.className]
 */
export default function AIAssistantPanel({ expediente, className = '' }) {
  const [input, setInput]         = useState('');
  const [loading, setLoading]     = useState(false);
  const [messages, setMessages]   = useState([]);
  const [copied, setCopied]       = useState(null);
  const [activeProvider, setActiveProvider] = useState(DEFAULT_PROVIDER);
  const [activeProviderLabel, setActiveProviderLabel] = useState(getProviderLabel(DEFAULT_PROVIDER));
  const [activeModel, setActiveModel] = useState(null);
  const inputRef                  = useRef(null);
  const bottomRef                 = useRef(null);

  /* Scroll al último mensaje */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text = input.trim()) => {
    if (!text || loading) return;
    setInput('');
    const userMsg = { id: Date.now(), role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const historial = messages.map(m => ({
        role: m.role === 'ai' ? 'model' : 'user',
        text: m.content,
      }));
      const data = await api.chat(text, historial, expediente?.id ?? null);
      const aiText = data?.respuesta ?? data?.texto ?? data?.resultado ?? (typeof data === 'string' ? data : JSON.stringify(data));

      // FIX LPDP-2: extraer proveedor del response para etiquetar este mensaje
      const providerId = data?.provider || DEFAULT_PROVIDER;
      const providerLabel = data?.provider_label || getProviderLabel(providerId);
      const providerModel = data?.model || null;
      setActiveProvider(providerId);
      setActiveProviderLabel(providerLabel);
      if (providerModel) setActiveModel(providerModel);

      // FIX RAG-1: extraer contexto RAG (citaciones, fuentes, métricas) del payload.
      // El backend expone estos campos vía `withRagContext` cuando ENABLE_RAG=true.
      // Si el RAG no se usó o no encontró chunks, los campos vendrán ausentes.
      const ragContext = {
        chunks_usados: data?.rag_chunks ?? 0,
        similitud_promedio: data?.rag_similitud_promedio ?? null,
        rag_usado: Boolean(data?.rag_usado),
        citaciones: Array.isArray(data?.citaciones) ? data.citaciones : [],
        fuentes: Array.isArray(data?.fuentes_consultadas) ? data.fuentes_consultadas : [],
        fecha_consulta: data?.rag_fecha_consulta ?? null,
      };

      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        content: aiText,
        provider: providerId,
        providerLabel,
        model: providerModel,
        rag: ragContext,
      }]);
    } catch (err) {
      const msg = err?.response?.data?.error || 'No se pudo obtener respuesta. Intenta de nuevo.';
      setMessages(prev => [...prev, {
        id: Date.now() + 1,
        role: 'ai',
        content: msg,
        provider: activeProvider,
        providerLabel: activeProviderLabel,
        model: activeModel,
        rag: null,
      }]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, expediente, activeProvider, activeProviderLabel, activeModel]);

  const handleKey = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  }, [sendMessage]);

  const copyMsg = useCallback(async (id, text) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  }, []);

  const QUICK_PROMPTS = [
    'Resumir el caso',
    'Plazos críticos',
    'Estrategia recomendada',
  ];

  return (
    <div className={`flex flex-col backdrop-blur-xl bg-white/5 border border-white/10
      rounded-2xl overflow-hidden h-full ${className}`}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-3
        border-b border-white/8 bg-linear-to-r from-violet-600/10 to-blue-600/5">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-violet-500/20 rounded-xl border border-violet-500/30">
            <Sparkles className="w-4 h-4 text-violet-400" />
          </div>
          <div className="flex flex-col gap-0.5">
            <h3 className="text-sm font-bold text-white">Asistente Legal IA</h3>
            {/* FIX LPDP-2: badge dinámico del proveedor activo (Art. 21 LPDP) */}
            <ProviderBadge
              providerId={activeProvider}
              model={activeModel}
            />
          </div>
        </div>
        <motion.span
          animate={{ opacity: [1, 0.5, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="flex items-center gap-1.5 px-2 py-1 rounded-full
            bg-violet-500/10 border border-violet-500/20 text-[10px] text-violet-400 font-semibold"
        >
          <span className="w-1.5 h-1.5 bg-violet-400 rounded-full" />
          EN LÍNEA
        </motion.span>
      </div>

      {/* ── Mensajes ── */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center h-full py-6 text-center"
          >
            <div className="p-3 bg-violet-500/10 rounded-2xl border border-violet-500/20 mb-3">
              <MessageSquare className="w-6 h-6 text-violet-400" />
            </div>
            <p className="text-sm text-slate-400 leading-relaxed max-w-[220px]">
              {expediente
                ? `Analizando Exp. ${expediente.numero ?? ''}`
                : 'Consulta sobre derecho peruano'}
            </p>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {messages.map(msg => (
            <MsgBubble
              key={msg.id}
              msg={msg}
              onCopy={copyMsg}
              copied={copied}
            />
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {loading && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex gap-2 items-end"
          >
            <div className="p-1.5 bg-violet-500/20 rounded-xl border border-violet-500/20">
              <Sparkles className="w-3 h-3 text-violet-400" />
            </div>
            <div className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-2xl rounded-bl-md">
              <p className="text-[11px] text-slate-400 mb-1.5">Consultando...</p>
              <div className="flex gap-1.5">
                {[0, 1, 2].map(i => (
                  <motion.span
                    key={i}
                    className="w-1.5 h-1.5 bg-violet-400 rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3], y: [0, -3, 0] }}
                    transition={{ duration: 0.7, delay: i * 0.15, repeat: Infinity }}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* ── Quick prompts ── */}
      <div className="px-3 pb-2 flex gap-1.5 overflow-x-auto">
        {QUICK_PROMPTS.map(p => (
          <button
            key={p}
            onClick={() => sendMessage(p)}
            disabled={loading}
            className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-medium
              bg-white/5 border border-white/10 text-slate-400
              hover:bg-white/10 hover:text-slate-200 transition-colors disabled:opacity-40"
          >
            {p}
          </button>
        ))}
      </div>

      {/* ── Input ── */}
      <div className="px-3 pb-3">
        <div className="flex items-end gap-2 bg-white/5 border border-white/12 rounded-xl p-2
          focus-within:border-violet-500/40 focus-within:ring-2 focus-within:ring-violet-500/20
          transition-all duration-200">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKey}
            placeholder="Consulta sobre el caso..."
            rows={1}
            aria-label="Mensaje para el asistente IA"
            className="flex-1 bg-transparent text-sm text-slate-200 placeholder:text-slate-600
              resize-none outline-none leading-5 max-h-20 overflow-y-auto"
          />
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => sendMessage()}
            disabled={!input.trim() || loading}
            aria-label="Enviar consulta"
            className="flex-shrink-0 p-1.5 rounded-lg bg-violet-600 text-white
              hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : <Send className="w-4 h-4" />
            }
          </motion.button>
        </div>
      </div>

      {/* ── CTA al chat completo ── */}
      <div className="px-3 pb-3">
        <Link
          to="/chat-ia"
          className="flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-semibold
            bg-violet-500/10 border border-violet-500/20 text-violet-400
            hover:bg-violet-500/20 hover:text-violet-300 transition-colors group"
        >
          Abrir chat completo
          <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    </div>
  );
}

/* ── Burbuja de mensaje ─────────────────────────────────── */
function MsgBubble({ msg, onCopy, copied }) {
  const isAI = msg.role === 'ai';
  const displayed = useTypewriter(isAI ? msg.content : '', 14);
  const text = isAI ? displayed : msg.content;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.25 }}
      className={`flex gap-2 ${isAI ? 'items-end' : 'items-end flex-row-reverse'}`}
    >
      {/* Avatar */}
      {isAI && (
        <div className="flex-shrink-0 p-1.5 bg-violet-500/20 border border-violet-500/25 rounded-xl">
          <Sparkles className="w-3 h-3 text-violet-400" />
        </div>
      )}

      {/* Bubble */}
      <div className={`group relative max-w-[85%] px-3 py-2.5 rounded-2xl text-sm leading-relaxed
        ${isAI
          ? 'bg-white/5 border border-white/10 text-slate-200 rounded-bl-md'
          : 'bg-blue-600 text-white rounded-br-md'}`}>
        {text}

        {/* FIX RAG-1: Indicador de estado RAG y citaciones verificables.
            Solo se renderiza para mensajes IA. CitacionesPanel hace
            early-return si no hay citaciones o `rag_usado` es false. */}
        {isAI && (
          <div className="mt-2 space-y-1">
            <RAGStatus
              ragContext={msg.rag ? {
                chunks_usados: msg.rag.chunks_usados,
                similitud_promedio: msg.rag.similitud_promedio,
                necesita_revision_humana: msg.rag.rag_usado && msg.rag.similitud_promedio != null && msg.rag.similitud_promedio < 0.65,
              } : null}
            />
            {msg.rag && (
              <CitacionesPanel
                citaciones={msg.rag.citaciones}
                fuentes={msg.rag.fuentes}
                ragUsado={msg.rag.rag_usado}
                similitudPromedio={msg.rag.similitud_promedio}
                idPrefix={`cit-${msg.id}`}
              />
            )}
          </div>
        )}

        {/* FIX LPDP-2: Badge del proveedor IA por mensaje (Art. 21 LPDP) */}
        {isAI && (
          <div className="mt-2 pt-2 border-t border-white/8">
            <ProviderBadge
              providerId={msg.provider}
              model={msg.model}
            />
          </div>
        )}

        {/* Copy button (solo IA) */}
        {isAI && msg.content && (
          <button
            onClick={() => onCopy(msg.id, msg.content)}
            aria-label="Copiar respuesta"
            className="absolute -top-2 -right-2 p-1.5 rounded-lg
              bg-slate-800 border border-white/12 text-slate-400
              opacity-0 group-hover:opacity-100 transition-all
              hover:text-white"
          >
            {copied === msg.id
              ? <Check className="w-3 h-3 text-emerald-400" />
              : <Copy className="w-3 h-3" />
            }
          </button>
        )}
      </div>
    </motion.div>
  );
}
