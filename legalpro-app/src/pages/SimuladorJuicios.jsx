import { useState } from 'react';
import AppIcon from '../components/AppIcon';
import Header from '../components/Header';
import IADisclaimerBanner from '../components/IADisclaimerBanner';
import simuladorFondo from '../assets/backgrounds/simulador_fondo.jpeg';
import { api } from '../api/client';

export default function SimuladorJuicios() {
  const [rol, setRol] = useState('abogado');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const roles = ['Juez', 'Fiscal', 'Abogado'];

  const handleSend = async () => {
    if (!input.trim()) return;
    const userMsg = input.trim();
    setMessages(prev => [...prev, { from: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);
    try {
      const data = await api.consulta?.(userMsg, 'simulador');
      const reply = data?.resultado ?? 'Respuesta del simulador no disponible.';
      setMessages(prev => [...prev, { from: 'ia', text: reply }]);
    } catch {
      setMessages(prev => [...prev, { from: 'ia', text: 'Error al conectar con el simulador.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter">
      {/* ─── FULL SCREEN BACKGROUND ─── */}
      <div className="fixed inset-0 z-[-1] pointer-events-none">
        <img src={simuladorFondo} alt="Fondo" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-linear-to-b from-[#0f131a]/80 via-[#0f131a]/95 to-[#0f131a]"></div>
      </div>

      <Header title="Simulador IA" showBack rightAction={
        <div className="flex gap-2">
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"><AppIcon name="history" size={20} /></button>
          <button className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors"><AppIcon name="settings" size={20} /></button>
        </div>
      } />

      {/* Role Selection */}
      <div className="px-4 py-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400 mb-3">Tu Rol en la Audiencia</h2>
        <div className="flex glass p-1 rounded-xl border border-white/5 shadow-md">
          {roles.map(r => (
            <button key={r} onClick={() => setRol(r.toLowerCase())}
              className={`flex-1 text-center py-2.5 rounded-lg text-sm font-medium transition-all ${rol === r.toLowerCase() ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}>
              {r}
            </button>
          ))}
        </div>
      </div>

      {/* Intro */}
      <div className="px-4 mb-6">
        <div className="glass card p-4 border border-indigo-500/20 shadow-[0_8px_32px_rgba(99,102,241,0.15)] relative overflow-hidden text-center">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -z-10"></div>
          <AppIcon name="psychology" size={28} className="icon-indigo mx-auto mb-2" />
          <h3 className="text-white font-bold text-base mb-2 leading-tight">Simulador de Audiencias con IA</h3>
          <p className="text-sm text-slate-300 leading-relaxed">Selecciona tu rol para comenzar la simulación.</p>
        </div>
      </div>

      {/* Gemini Feedback */}
      <div className="px-4 mb-6">
        <IADisclaimerBanner compact className="mb-3" />
        <div className="glass border border-primary/20 rounded-xl p-4 shadow-lg shadow-indigo-500/5">
          <div className="flex items-center gap-2 mb-3">
            <AppIcon name="psychology" size={20} className="icon-indigo" />
            <span className="text-sm font-bold text-primary uppercase tracking-tight">Análisis IA Gemini</span>
          </div>
          <div className="space-y-3">
            <div className="flex gap-3">
              <AppIcon name="info" size={20} className="icon-muted" />
              <div>
                <p className="text-sm font-semibold">Simulación activa</p>
                <p className="text-xs text-slate-400">Los argumentos se generarán en tiempo real según tu rol seleccionado.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Simulation */}
      <div className="px-4 space-y-4 pb-4">
        {messages.length === 0 && (
          <div className="flex justify-start">
            <div className="max-w-[85%] chat-ai p-3 shadow-sm border border-white/5">
              <p className="text-xs font-bold text-slate-400 mb-1 uppercase">Sistema</p>
              <p className="text-sm">Selecciona tu rol para comenzar la simulación.</p>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 shadow-sm border border-white/5 ${m.from === 'user' ? 'chat-user' : 'chat-ai'}`}>
              <p className="text-xs font-bold opacity-80 mb-1 uppercase">{m.from === 'user' ? `Tú (${rol})` : 'IA'}</p>
              <p className="text-sm">{m.text}</p>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] chat-ai p-3 shadow-sm border border-white/5">
              <p className="text-xs font-bold text-slate-400 mb-1 uppercase">IA</p>
              <p className="text-sm">Escribiendo...</p>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="px-4 pb-28">
        <div className="flex gap-2 items-center glass rounded-full pl-4 pr-1 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)] border border-white/10">
          <input
            className="flex-1 bg-transparent border-none outline-none text-sm py-2 placeholder:text-slate-500"
            placeholder="Escribe tu argumento legal..."
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="bg-linear-to-br from-indigo-500 to-violet-600 text-white rounded-full p-2.5 flex items-center justify-center hover:scale-105 transition-transform shadow-lg disabled:opacity-50"
          >
            <AppIcon name="send" size={20} className="icon-raw" style={{ filter: 'brightness(0) invert(1)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
