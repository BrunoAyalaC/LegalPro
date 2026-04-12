import { useState } from 'react';
import AppIcon from '../components/AppIcon';
import Header from '../components/Header';
import simuladorFondo from '../assets/backgrounds/simulador_fondo.jpeg';

export default function SimuladorJuicios() {
  const [rol, setRol] = useState('abogado');
  const roles = ['Juez', 'Fiscal', 'Abogado'];

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

      {/* Case Summary Card */}
      <div className="px-4 mb-6">
        <div className="glass card p-4 border border-indigo-500/20 shadow-[0_8px_32px_rgba(99,102,241,0.15)] relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl -z-10"></div>
          
          <div className="flex items-center gap-2 mb-2">
            <span className="badge badge-primary">Penal</span>
            <span className="text-xs text-slate-400 font-medium tracking-wide">Exp. 00123-2023-JR-PE</span>
          </div>
          
          <h3 className="text-white font-bold text-base mb-2 leading-tight">Analizando Tipicidad: Caso Colusión Agravada</h3>
          
          <p className="text-sm text-slate-300 leading-relaxed mb-4">
            Acusación por colusión agravada en la licitación del Puente Tarata III. Análisis de tipicidad según el Código Procesal Penal peruano.
          </p>
          
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-3 py-2 rounded-lg w-fit">
            <AppIcon name="menu_book" size={18} className="icon-indigo" />
            <span>Jurisprudencia: R.N. 123-2022 Lima</span>
          </div>
        </div>
      </div>

      {/* Gemini Feedback */}
      <div className="px-4 mb-6">
        <div className="glass border border-primary/20 rounded-xl p-4 shadow-lg shadow-indigo-500/5">
          <div className="flex items-center gap-2 mb-3">
            <AppIcon name="psychology" size={20} className="icon-indigo" />
            <span className="text-sm font-bold text-primary uppercase tracking-tight">Análisis IA Gemini</span>
          </div>
          <div className="space-y-3">
            <div className="flex gap-3">
              <AppIcon name="check_circle" size={20} className="icon-indigo" />
              <div>
                <p className="text-sm font-semibold">Fortaleza Legal</p>
                <p className="text-xs text-slate-400">Correcta citación del Art. 384 del CP. El argumento sobre el perjuicio patrimonial es sólido.</p>
              </div>
            </div>
            <div className="flex gap-3">
              <AppIcon name="warning" size={20} className="icon-muted" />
              <div>
                <p className="text-sm font-semibold text-amber-500">Sugerencia Estratégica</p>
                <p className="text-xs text-slate-400">Refuerce la conexión entre la conducta del imputado y el acuerdo colusorio detectado en los chats.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Chat Simulation */}
      <div className="px-4 space-y-4 pb-4">
        <div className="flex justify-start">
          <div className="max-w-[85%] chat-ai p-3 shadow-sm border border-white/5">
            <p className="text-xs font-bold text-slate-400 mb-1 uppercase">Juez de Investigación</p>
            <p className="text-sm">Señor Abogado, ¿cuál es su fundamento respecto a la falta de pruebas de concertación previa?</p>
          </div>
        </div>
        <div className="flex justify-end">
          <div className="max-w-[85%] chat-user p-3 shadow-sm">
            <p className="text-xs font-bold opacity-80 mb-1 uppercase">Tú (Abogado Defensor)</p>
            <p className="text-sm">Señor Juez, conforme al Art. 384, no existe evidencia directa de pacto ilícito. Las reuniones citadas por Fiscalía son de carácter técnico...</p>
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="px-4 pb-28">
        <div className="flex gap-2 items-center glass rounded-full pl-4 pr-1 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)] border border-white/10">
          <input className="flex-1 bg-transparent border-none outline-none text-sm py-2 placeholder:text-slate-500" placeholder="Escribe tu argumento legal..." />
          <button className="bg-linear-to-br from-indigo-500 to-violet-600 text-white rounded-full p-2.5 flex items-center justify-center hover:scale-105 transition-transform shadow-lg">
            <AppIcon name="send" size={20} className="icon-raw" style={{ filter: 'brightness(0) invert(1)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
