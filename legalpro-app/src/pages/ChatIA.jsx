import { useState, useRef, useEffect, useCallback } from 'react';
import DOMPurify from 'dompurify';

import AppIcon from '../components/AppIcon';
import { useSearchParams } from 'react-router-dom';
import Header from '../components/Header';
import api from '../api/client';
import avatarIA from '../assets/avatar/avatar_ia.jpeg';
import chatVacioImg from '../assets/empty-states/chat_ia_vacio.png';

const STORAGE_KEY = 'legalpro_chat_messages';
const MAX_STORED = 100; // máximo de mensajes a guardar en localStorage

export default function ChatIA() {
  const [searchParams] = useSearchParams();
  const expedienteId = searchParams.get('expediente_id');

  // Restaurar mensajes desde localStorage al montar
  const [messages, setMessages] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [_funcUsadas, setFuncUsadas] = useState([]);
  const messagesEnd = useRef(null);

  // Persistir mensajes en localStorage en cada cambio
  useEffect(() => {
    try {
      const toSave = messages.slice(-MAX_STORED);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
    } catch {
      // localStorage lleno → limpiar mensajes más viejos
      const trimmed = messages.slice(-20);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed)); } catch { /* ignore */ }
    }
  }, [messages]);

  useEffect(() => { messagesEnd.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const handleClearChat = useCallback(() => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  const quickActions = [
    { icon: 'summarize', label: 'Resumir expediente', prompt: '¿Puedes resumir los hechos principales de mi expediente activo más urgente?' },
    { icon: 'find_in_page', label: 'Buscar jurisprudencia', prompt: 'Busca jurisprudencia relevante en materia penal sobre delitos contra el patrimonio' },
    { icon: 'edit_note', label: 'Redactar escrito', prompt: 'Necesito redactar una demanda de alimentos' },
    { icon: 'schedule', label: 'Calcular plazos', prompt: '¿Qué plazos procesales debo considerar para una apelación en un proceso civil?' },
    { icon: 'trending_up', label: 'Predecir resultado', prompt: 'Predice el resultado probable de un caso de colusión agravada' },
    { icon: 'psychology', label: 'Estrategia legal', prompt: 'Genera una estrategia de defensa para un caso de despido arbitrario' },
  ];

  const handleSend = async (text) => {
    if (loading) return; // guard: evitar envíos simultáneos (#2)
    const mensaje = text || input.trim();
    if (!mensaje) return;

    setMessages(prev => [...prev, { role: 'user', text: mensaje, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }]);
    setInput('');
    setLoading(true);

    try {
      const historial = messages.filter(m => m.role !== 'ai' || messages.indexOf(m) > 0).map(m => ({ role: m.role === 'user' ? 'user' : 'model', text: m.text }));
      const result = await api.chat(mensaje, historial, expedienteId ? parseInt(expedienteId) : null);
      
      setFuncUsadas(result.funciones_usadas || []);
      setMessages(prev => [...prev, {
        role: 'ai',
        text: result.respuesta,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        funciones: result.funciones_usadas,
        modo: result.modo
      }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', text: 'Error al conectar con el servidor. Verifica que el backend esté corriendo en el puerto 3001.', time: 'Error' }]);
    }
    setLoading(false);
  };

  const formatMessage = (text) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-primary-light">$1</strong>')
      .replace(/\n/g, '<br/>')
      .replace(/📋|📝|🔍|⏰|📊|⚔️|📚|✅|⚠️|❌|💡|🎯|📌|⚖️/g, '<span class="text-lg">$&</span>');
  };

  const isEmpty = messages.length === 0;

  return (
    <div className="flex flex-col h-screen">
      <Header title="LegalPro AI" subtitle="Asistente Legal con Gemini" showBack
        rightAction={
          <div className="flex items-center gap-2">
            {messages.length > 0 && (
              <button
                onClick={handleClearChat}
                className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-red-400/10 transition-colors"
                title="Limpiar chat"
              >
                <AppIcon name="delete_sweep" size={20} />
              </button>
            )}
            <span className="badge badge-primary"><AppIcon name="auto_awesome" size={20} /> Gemini 2.0</span>
          </div>
        }
      />

      {/* Quick Actions */}
      <div className="flex overflow-x-auto gap-2 px-4 py-3 no-scrollbar border-b border-border-dark">
        {quickActions.map((a, i) => (
          <button key={i} onClick={() => handleSend(a.prompt)}
            className="whitespace-nowrap bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold px-3 py-2 rounded-full border border-primary/20 transition-colors flex items-center gap-1.5">
            <AppIcon name={a.icon} size={20} />{a.label}
          </button>
        ))}
      </div>

      {/* Messages or Empty State */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {isEmpty ? (
          <div className="empty-state h-full">
            <img src={chatVacioImg} alt="Chat IA vacío" />
            <h3>¡Hola! Soy <span className="gradient-text">Lex-IA</span></h3>
            <p>Tu asistente legal inteligente con Gemini. Selecciona una acción rápida o escríbeme una consulta.</p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse max-w-[85%] ml-auto' : 'max-w-[90%]'} anim-fade-in-up`}>
                {msg.role === 'ai' ? (
                  <img src={avatarIA} alt="Lex-IA" className="ai-avatar" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center shrink-0">
                    <AppIcon name="person" size={20} />
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <div className={msg.role === 'user' ? 'chat-user p-3' : 'chat-ai p-3'}>
                    <div className="text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(formatMessage(msg.text), { ALLOWED_TAGS: ['strong', 'br', 'span'], ALLOWED_ATTR: ['class'] }) }}></div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{msg.time}</span>
                    {msg.funciones?.length > 0 && (
                      <span className="text-xs text-primary flex items-center gap-1">
                        <AppIcon name="functions" size={20} />
                        {msg.funciones.map(f => f.nombre).join(', ')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </>
        )}

        {loading && (
          <div className="flex gap-3 max-w-[85%]">
            <img src={avatarIA} alt="Lex-IA" className="ai-avatar" />
            <div className="chat-ai p-3 flex items-center gap-2">
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <div className="typing-dot"></div>
              <span className="text-[10px] text-slate-400 ml-2">Analizando con Gemini...</span>
            </div>
          </div>
        )}
        <div ref={messagesEnd} />
      </div>

      {/* Input */}
      <div className="p-4 glass border-t border-border-dark pb-safe">
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-surface-dark rounded-2xl border border-border-dark px-4 py-2.5 flex items-center">
            <input value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSend()}
              disabled={loading}
              aria-label="Mensaje al asistente legal"
              className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-500 disabled:opacity-60"
              placeholder="Consulta legal..." />
            <button className="text-slate-400 hover:text-primary transition-colors">
              <AppIcon name="mic" size={20} />
            </button>
          </div>
          <button onClick={() => handleSend()}
            disabled={loading}
            className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center shadow-lg disabled:opacity-50 active:scale-95 transition-all"
            style={{ boxShadow: '0 4px 16px rgba(19, 91, 236, 0.3)' }}>
            <AppIcon name="send" size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
