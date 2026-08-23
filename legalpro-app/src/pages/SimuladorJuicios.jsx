import { useState, useEffect, useRef } from 'react';
import AppIcon from '../components/AppIcon';
import Header from '../components/Header';
import IADisclaimerBanner from '../components/IADisclaimerBanner';
import IADisclaimerModal from '../components/IADisclaimerModal';
import simuladorFondo from '../assets/backgrounds/simulador_fondo.jpeg';
import simuladorFondoWebp from '../assets/backgrounds/simulador_fondo.webp';
import { dotnetClient } from '../api/client';
import { logger } from '../utils/logger';

// ── Helpers ───────────────────────────────────────────────────────────────
// Mapea la elección de rol del usuario al enum TipoRamaProcesal del backend.
// Por defecto asumimos 'Penal' (la rama más común en simulaciones orales).
const ROL_A_RAMA = {
  juez:    'Penal',
  fiscal:  'Penal',
  abogado: 'Penal',
};

export default function SimuladorJuicios() {
  const [rol, setRol] = useState('abogado');
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [simulacionId, setSimulacionId] = useState(null);
  const [descripcionCaso, setDescripcionCaso] = useState('');
  const [iniciado, setIniciado] = useState(false);
  const [contexto, setContexto] = useState('');
  const [error, setError] = useState('');
  const [showDisclaimerModal, setShowDisclaimerModal] = useState(false);
  const roles = ['Juez', 'Fiscal', 'Abogado'];

  // ── AbortController compartido: cancela peticiones en vuelo si el usuario
  //    inicia otra simulación o si el componente se desmonta ──────────────
  const controllerRef = useRef(null);
  useEffect(() => {
    return () => {
      if (controllerRef.current) controllerRef.current.abort();
    };
  }, []);

  const handleIniciarClick = () => {
    if (!descripcionCaso.trim()) {
      setError('Describe brevemente el caso antes de iniciar.');
      return;
    }
    setShowDisclaimerModal(true);
  };

  const handleDisclaimerConfirm = async () => {
    setShowDisclaimerModal(false);
    await iniciarSimulacionConfirmed();
  };

  const handleDisclaimerCancel = () => {
    setShowDisclaimerModal(false);
  };

  // ── Paso 1: iniciar la simulación con descripción del caso ─────────────
  const iniciarSimulacionConfirmed = async () => {
    if (!descripcionCaso.trim()) {
      setError('Describe brevemente el caso antes de iniciar.');
      return;
    }
    setError('');
    // Cancelar petición previa si existe
    if (controllerRef.current) controllerRef.current.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setLoading(true);
    setMessages([]);
    try {
      const { data } = await dotnetClient.post(
        '/api/simulacion/iniciar',
        {
          rama: ROL_A_RAMA[rol] || 'Penal',
          rolUsuario: rol.charAt(0).toUpperCase() + rol.slice(1),
          dificultad: 'Media',
          descripcionCaso: descripcionCaso.trim(),
        },
        { signal: controller.signal }
      );
      setSimulacionId(data.simulacionId);
      setContexto(data.contextoSintetico || '');
      setIniciado(true);
      // Mensaje de apertura del juez
      const apertura = [
        data.mensajeJuez,
        data.mensajeAdversarial ? `\n— ${data.rolAdversarial || 'Parte contraria'}: ${data.mensajeAdversarial}` : '',
      ].filter(Boolean).join('\n');
      if (apertura) {
        setMessages([{ from: 'ia', text: apertura }]);
      }
    } catch (err) {
      if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
      logger.error('[SimuladorJuicios] Error al iniciar:', err);
      setError(err?.response?.data?.error || err?.message || 'No se pudo iniciar la simulación.');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  };

  // ── Paso 2: enviar argumento del usuario como turno ──────────────────────
  const handleSend = async () => {
    if (!input.trim() || loading) return;
    if (!simulacionId) {
      setError('Primero inicia la simulación con una descripción del caso.');
      return;
    }
    const userMsg = input.trim();
    setMessages(prev => [...prev, { from: 'user', text: userMsg }]);
    setInput('');
    setLoading(true);
    setError('');
    try {
      const { data } = await dotnetClient.post(
        '/api/simulacion/turno',
        { simulacionId, mensajeUsuario: userMsg },
        { signal: controllerRef.current?.signal }
      );
      const reply = data?.mensajeRespuesta || data?.evaluacionTurno || 'Respuesta del simulador no disponible.';
      setMessages(prev => [...prev, { from: 'ia', text: reply }]);
    } catch (err) {
      if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
      logger.error('[SimuladorJuicios] Error al enviar turno:', err);
      setError(err?.response?.data?.error || err?.message || 'Error al conectar con el simulador.');
      setMessages(prev => [...prev, { from: 'ia', text: 'Error al conectar con el simulador.' }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter">
      {/* ─── FULL SCREEN BACKGROUND — WebP con fallback JPEG, lazy ─── */}
      <div className="fixed inset-0 z-[-1] pointer-events-none">
        <picture>
          <source srcSet={simuladorFondoWebp} type="image/webp" />
          <img src={simuladorFondo} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" />
        </picture>
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
          <p className="text-sm text-slate-300 leading-relaxed">
            {iniciado
              ? `Simulación activa. Eres ${rol}. Responde a los argumentos del adversario.`
              : 'Selecciona tu rol y describe el caso para iniciar la simulación.'}
          </p>
        </div>
      </div>

      {/* Descripción del caso (paso previo al chat) */}
      {!iniciado && (
        <div className="px-4 mb-6">
          <label className="block mb-2">
            <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">
              Descripción breve del caso
            </span>
            <textarea
              className="input w-full min-h-[90px] resize-none"
              placeholder="Ej: Audiencia de juzgamiento por hurto agravado en grado de tentativa, hechos ocurridos el 12/03/2025..."
              value={descripcionCaso}
              onChange={(e) => setDescripcionCaso(e.target.value)}
              maxLength={2000}
              disabled={loading}
            />
          </label>
          {error && (
            <p className="text-xs text-red-400 mb-2">{error}</p>
          )}
          <button
            onClick={handleIniciarClick}
            disabled={loading || !descripcionCaso.trim()}
            className="btn btn-primary w-full text-xs disabled:opacity-50"
          >
            <AppIcon name="play_arrow" size={18} />
            {loading ? 'Iniciando...' : 'Iniciar simulación'}
          </button>
        </div>
      )}

      {error && iniciado && (
        <div className="px-4 mb-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {contexto && iniciado && (
        <div className="px-4 mb-4">
          <details className="text-xs text-slate-400 glass border border-white/5 rounded-lg p-3">
            <summary className="cursor-pointer text-slate-300 font-semibold">Contexto del caso (IA)</summary>
            <p className="mt-2 leading-relaxed whitespace-pre-wrap">{contexto}</p>
          </details>
        </div>
      )}

      {/* LPDP simulador #7C3AED violeta no dismissible */}
      <div className="px-4 mb-6">
        <IADisclaimerBanner variant="simulador" dismissible={false} compact className="mb-3" />
        <div className="glass border border-primary/20 rounded-xl p-4 shadow-lg shadow-indigo-500/5">
          <div className="flex items-center gap-2 mb-3">
            <AppIcon name="psychology" size={20} className="icon-indigo" />
            <span className="text-sm font-bold text-primary uppercase tracking-tight">Análisis IA DeepSeek V4 Flash</span>
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
        {!iniciado && messages.length === 0 && (
          <div className="flex justify-start">
            <div className="max-w-[85%] chat-ai p-3 shadow-sm border border-white/5">
              <p className="text-xs font-bold text-slate-400 mb-1 uppercase">Sistema</p>
              <p className="text-sm">Selecciona tu rol y describe el caso para iniciar la simulación.</p>
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 shadow-sm border border-white/5 ${m.from === 'user' ? 'chat-user' : 'chat-ai'}`}>
              <p className="text-xs font-bold opacity-80 mb-1 uppercase">{m.from === 'user' ? `Tú (${rol})` : 'IA'}</p>
              <p className="text-sm whitespace-pre-wrap">{m.text}</p>
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

      {/* Modal bloqueante simulador #7C3AED */}
      <IADisclaimerModal
        isOpen={showDisclaimerModal}
        variant="simulador"
        persistent
        actionLabel="Aceptar y Simular"
        onConfirm={handleDisclaimerConfirm}
        onCancel={handleDisclaimerCancel}
      />

      {/* Input */}
      <div className="px-4 pb-28 lg:pb-8">
        <div className="flex gap-2 items-center glass rounded-full pl-4 pr-1 py-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)] border border-white/10">
          <input
            className="flex-1 bg-transparent border-none outline-none text-sm py-2 placeholder:text-slate-500"
            placeholder={iniciado ? 'Escribe tu argumento legal...' : 'Inicia la simulación para escribir tu argumento'}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={!iniciado}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim() || !iniciado}
            className="bg-linear-to-br from-indigo-500 to-violet-600 text-white rounded-full p-2.5 flex items-center justify-center hover:scale-105 transition-transform shadow-lg disabled:opacity-50"
          >
            <AppIcon name="send" size={20} className="icon-raw" style={{ filter: 'brightness(0) invert(1)' }} />
          </button>
        </div>
      </div>
    </div>
  );
}
