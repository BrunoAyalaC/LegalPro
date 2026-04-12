import { useState } from 'react';
import AppIcon from '../components/AppIcon';
import Header from '../components/Header';
import { api } from '../api/client';

export default function AnalistaExpedientes() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', content: 'He analizado el expediente. He detectado una contradicción relevante entre los folios 12 y 45, y una posible nulidad por falta de notificación según el CPC. ¿En qué puedo ayudarte?' }
  ]);

  const sendMessage = async (promptText) => {
    const text = (promptText || input).trim();
    if (!text) return;
    setMessages(prev => [...prev, { role: 'user', content: text }]);
    setInput('');
    setLoading(true);
    try {
      const data = await api.consulta(text, 'analisis');
      const resp = data.resultado;
      let content;
      if (resp && typeof resp === 'object') {
        content = [
          resp.resumenGeneral && `Resumen: ${resp.resumenGeneral}`,
          resp.hechosClave && `Hechos clave: ${Array.isArray(resp.hechosClave) ? resp.hechosClave.join('; ') : resp.hechosClave}`,
          resp.inconsistencias && `Inconsistencias: ${Array.isArray(resp.inconsistencias) ? resp.inconsistencias.join('; ') : resp.inconsistencias}`,
          resp.riesgosProcesales && `Riesgos procesales: ${Array.isArray(resp.riesgosProcesales) ? resp.riesgosProcesales.join('; ') : resp.riesgosProcesales}`,
          resp.estrategiaRecomendada && `Estrategia recomendada: ${resp.estrategiaRecomendada}`,
        ].filter(Boolean).join('\n\n');
      } else {
        content = typeof resp === 'string' ? resp : JSON.stringify(resp);
      }
      setMessages(prev => [...prev, { role: 'ai', content }]);
    } catch {
      setMessages(prev => [...prev, { role: 'ai', content: 'Error al conectar con el servidor.' }]);
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

  return (
    <div className="page-enter flex flex-col h-screen">
      <Header title="Expediente N° 042-2023" showBack
        rightAction={<span className="badge badge-primary"><AppIcon name="auto_awesome" size={20} /> Gemini 2.0</span>}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Document Viewer */}
        <div className="relative h-[45%] bg-surface-dark overflow-y-auto border-b border-border-dark shadow-inner">
          <div className="p-6 max-w-lg mx-auto">
            <div className="bg-white/5 shadow-xl rounded p-8 min-h-[400px] relative text-[11px] leading-relaxed text-slate-300 font-serif">
              <p className="font-bold mb-4 text-center text-sm text-slate-100">CORTE SUPERIOR DE JUSTICIA DE LIMA</p>
              <p className="mb-4 text-slate-400">EXPEDIENTE: 0042-2023-0-1801-JR-PE-01</p>
              <p className="mb-4">...que habiendo analizado los hechos expuestos por el recurrente en el folio 12, se determina que el imputado no se encontraba en el lugar de los hechos al momento de la intervención policial...</p>
              
              <div className="relative bg-red-500/10 border-l-2 border-red-500 px-3 my-3 py-2">
                <p>Sin embargo, en la declaración preventiva (Folio 45) se indica una ubicación contradictoria cercana a la Av. Abancay...</p>
                <div className="absolute -right-2 top-0 translate-x-full bg-red-500 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap font-sans font-bold flex items-center gap-1 z-10">
                  <AppIcon name="warning" size={20} />Contradicción detectada
                </div>
              </div>
              
              <p className="mb-4">Por lo tanto, se solicita la aplicación de los beneficios procesales correspondientes...</p>
              
              <div className="relative bg-primary/10 border-l-2 border-primary px-3 my-3 py-2">
                <p>...según lo tipificado en el Código Penal referente al delito contra la vida, el cuerpo y la salud...</p>
                <div className="absolute -right-2 top-0 translate-x-full bg-primary text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap font-sans font-bold flex items-center gap-1 z-10">
                  <AppIcon name="gavel" size={20} />Artículo 106 CP
                </div>
              </div>
            </div>
          </div>
          <div className="absolute top-4 right-4 glass text-[10px] px-3 py-1.5 rounded-full flex items-center gap-2">
            <AppIcon name="description" size={20} />Pág. 1 / 15
          </div>
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
