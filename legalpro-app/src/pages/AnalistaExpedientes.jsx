import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
import Header from '../components/Header';
import IADisclaimerBanner from '../components/IADisclaimerBanner';
import { api } from '../api/client';
import { getProviderLabel } from '../lib/iaProviders.js';
import { useSeo } from '../hooks/useSeo';

export default function AnalistaExpedientes() {
  const { id } = useParams();
  const [expediente, setExpediente] = useState(null);
  const [loadingExp, setLoadingExp] = useState(true);
  const [errorExp, setErrorExp] = useState('');

  const [documentos, setDocumentos] = useState([]);
  const [loadingDocs, setLoadingDocs] = useState(true);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setLoadingExp(true);
    setErrorExp('');
    api.getExpediente(id)
      .then(data => { if (!cancelled) { setExpediente(data); setLoadingExp(false); } })
      .catch(() => { if (!cancelled) { setErrorExp('Expediente no encontrado'); setLoadingExp(false); } });

    setLoadingDocs(true);
    api.getDocumentos(id)
      .then(data => { if (!cancelled) { setDocumentos(Array.isArray(data) ? data : []); setLoadingDocs(false); } })
      .catch(() => { if (!cancelled) { setDocumentos([]); setLoadingDocs(false); } });

    return () => { cancelled = true; };
  }, [id]);

  useSeo({
    title: expediente
      ? `Análisis de Expediente ${expediente.numero || expediente.id} | LegalPro`
      : 'Análisis de Expediente | LegalPro',
    description: expediente
      ? `Consulta detalles, resume hechos, detecta plazos procesales y analiza la jurisprudencia asociada al expediente judicial N° ${expediente.numero || expediente.id} con ayuda de Lex-IA.`
      : 'Analiza expedientes judiciales con Lex-IA: resume hechos, detecta plazos y revisa jurisprudencia relevante.',
  });

  const sendMessage = async (promptText) => {
    const text = (promptText || input).trim();
    if (!text) return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    try {
      const historial = messages.map(m => ({
        role: m.role === 'ai' ? 'model' : 'user',
        text: m.content,
      }));
      const data = await api.chat(text, historial, id);
      const resp = data?.respuesta ?? data?.texto ?? data?.resultado ?? (typeof data === 'string' ? data : JSON.stringify(data));
      setMessages(prev => [...prev, { role: 'ai', content: resp }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: 'No se pudo obtener respuesta. Intenta de nuevo.' }]);
    } finally {
      setLoading(false);
    }
  };

  const quickActions = [
    { icon: 'summarize', label: 'Resumir hechos', prompt: 'Resume los hechos principales del expediente' },
    { icon: 'find_in_page', label: 'Extraer pruebas', prompt: 'Extrae y lista todas las pruebas relevantes del expediente' },
    { icon: 'menu_book', label: 'Citar base legal', prompt: 'Cita los artículos legales aplicables a este expediente' },
    { icon: 'warning', label: 'Detectar nulidades', prompt: 'Detecta posibles nulidades procesales en este expediente' },
  ];

  if (loadingExp) {
    return (
      <div className="page-enter flex flex-col h-[calc(100dvh-148px)] lg:h-[calc(100dvh-64px)] items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm">Cargando expediente...</p>
      </div>
    );
  }

  if (errorExp) {
    return (
      <div className="page-enter flex flex-col h-[calc(100dvh-148px)] lg:h-[calc(100dvh-64px)] items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mb-4">
          <AppIcon name="error_outline" size={32} />
        </div>
        <h2 className="text-lg font-bold text-white mb-2">{errorExp}</h2>
        <p className="text-sm text-slate-400 mb-6">El expediente que buscas no existe o no tienes acceso.</p>
        <Link to="/expedientes" className="btn btn-primary">
          <AppIcon name="arrow_back" size={20} /> Volver a Expedientes
        </Link>
      </div>
    );
  }

  return (
    <div className="page-enter flex flex-col h-[calc(100dvh-148px)] lg:h-[calc(100dvh-64px)] overflow-hidden">
      <Header title={expediente ? `Expediente N° ${expediente.numero || expediente.id}` : 'Expediente'} showBack
        rightAction={<span className="badge badge-primary"><AppIcon name="auto_awesome" size={20} /> {getProviderLabel('opencode')}</span>}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Document Viewer */}
        <div className="relative h-[45%] bg-surface-dark overflow-y-auto border-b border-border-dark shadow-inner">
          {loadingDocs ? (
            <div className="flex items-center justify-center h-full text-slate-400 text-sm">
              Cargando documentos...
            </div>
          ) : documentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-6">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <AppIcon name="description" size={24} />
              </div>
              <p className="text-sm text-slate-400">No hay documentos asociados a este expediente.</p>
            </div>
          ) : (
            <div className="p-6 max-w-lg mx-auto space-y-4">
              {documentos.map((doc, i) => (
                <div key={doc.id ?? i} className="bg-white/5 border border-border-dark rounded-xl p-5">
                  <p className="text-sm font-bold text-white mb-2">{doc.titulo || 'Documento sin título'}</p>
                  <p className="text-xs text-slate-400 leading-relaxed line-clamp-6">{doc.contenido || 'Sin contenido'}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Chat Panel */}
        <div className="h-[55%] flex flex-col">
          <div className="flex overflow-x-auto gap-2 p-3 no-scrollbar border-b border-border-dark shrink-0">
            {quickActions.map((a, i) => (
              <button
                key={i}
                onClick={() => sendMessage(a.prompt)}
                disabled={loading}
                className="whitespace-nowrap bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold px-3 py-2 rounded-full border border-primary/20 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <AppIcon name={a.icon} size={20} />{a.label}
              </button>
            ))}
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.some(m => m.role === 'ai') && <IADisclaimerBanner compact className="mb-2" />}
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center text-slate-500 text-sm">
                <p>¿En qué puedo ayudarte con este expediente?</p>
              </div>
            )}
            {messages.map((msg, i) => (
              msg.role === 'ai' ? (
                <div key={i} className="flex gap-3 max-w-[85%]">
                  <div className="w-8 h-8 rounded-full bg-linear-to-br from-primary to-indigo-600 flex items-center justify-center shrink-0 shadow-lg">
                    <AppIcon name="smart_toy" size={20} />
                  </div>
                  <div className="chat-ai p-3">
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    <span className="text-xs text-slate-400 mt-2 block">{new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-3 max-w-[85%] ml-auto flex-row-reverse">
                  <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center shrink-0">
                    <AppIcon name="person" size={20} />
                  </div>
                  <div className="bg-primary/20 border border-primary/30 rounded-2xl rounded-tr-sm p-3">
                    <p className="text-xs leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              )
            ))}
            {loading && (
              <div className="flex gap-3 max-w-[85%]">
                <div className="w-8 h-8 rounded-full bg-linear-to-br from-primary to-indigo-600 flex items-center justify-center shrink-0 shadow-lg">
                  <AppIcon name="smart_toy" size={20} />
                </div>
                <div className="chat-ai p-3">
                  <p className="text-xs text-slate-400 mb-2">Consultando...</p>
                  <div className="flex gap-1 items-center">
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="p-4 glass border-t border-border-dark shrink-0 pb-safe">
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-surface-dark rounded-2xl border border-border-dark px-4 py-2.5 flex items-center">
                <input
                  aria-label="Consulta al analista"
                  className="bg-transparent border-none outline-none text-sm w-full placeholder:text-slate-500"
                  placeholder="¿Hay nulidades en esta notificación?"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && sendMessage()}
                  disabled={loading}
                />
              </div>
              <button
                className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center shadow-lg disabled:opacity-50"
                onClick={() => sendMessage()}
                disabled={loading || !input.trim()}
              >
                <AppIcon name="send" size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
