/**
 * AIAssistantPanel — Panel embebido del asistente Gemini.
 * Features: chat mini, últimas consultas, typewriter en respuesta, CTA a chat completo.
 * Sintaxis moderna: motion/react animate con spring
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles, Send, Loader2, ChevronRight,
  RefreshCw, Copy, Check, MessageSquare,
} from 'lucide-react';
import { Link } from 'react-router-dom';

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

/* ── Consultas de demo ───────────────────────────────────── */
const DEMO_RESPONSES = [
  'Según el Art. 442 del CPC, el emplazamiento debe efectuarse dentro de los 5 días hábiles. Recomiendo presentar el escrito de subsanación adjuntando los documentos faltantes antes del vencimiento del plazo.',
  'Analizando los hechos descritos, existe fundamento para invocar la causal de nulidad por defecto de notificación conforme al Art. 171 del CPC. La jurisprudencia del TC en el Exp. 1209-2020-PA/TC respalda esta postura.',
  'El expediente presenta plazos críticos: audiencia en 3 días y vencimiento de plazo probatorio en 8 días. Prioriza la presentación de los testigos y el peritaje contable.',
];

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

    /* Simular delay de Gemini (reemplazar con llamada real a /api/ai) */
    await new Promise(r => setTimeout(r, 1400 + Math.random() * 800));
    const aiText = DEMO_RESPONSES[Math.floor(Math.random() * DEMO_RESPONSES.length)];
    setMessages(prev => [...prev, { id: Date.now() + 1, role: 'ai', content: aiText }]);
    setLoading(false);
  }, [input, loading]);

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
          <div>
            <h3 className="text-sm font-bold text-white">Asistente Legal IA</h3>
            <p className="text-xs text-slate-400 leading-none mt-0.5">Powered by Gemini</p>
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
