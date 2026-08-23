import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale,
  Gavel,
  Briefcase,
  ShieldAlert,
  Users,
  Building2,
  Sparkles,
  Brain,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Loader2,
  Send,
  Copy,
  Check,
  RefreshCw,
  Sliders,
  ArrowLeft,
  Clock,
  Database
} from 'lucide-react';
import { getToken } from '../api/client';
import Header from '../components/Header';
import IADisclaimerBanner from '../components/IADisclaimerBanner';

// Configuración de especialidades para visualización en el frontend
const ESPECIALIDADES_INFO = {
  civil: {
    id: 'civil',
    nombre: 'Derecho Civil',
    descripcion: 'Código Civil y Procesal Civil. Enfoque en plazos de demandas e impulso judicial.',
    icon: Scale,
    color: 'from-blue-500 to-indigo-600',
    textClass: 'text-blue-400',
    bgClass: 'bg-blue-500/10 border-blue-500/20'
  },
  penal: {
    id: 'penal',
    nombre: 'Derecho Penal',
    descripcion: 'Código Penal y NCPP. Análisis de tipicidad, plazos fiscales y medidas limitativas.',
    icon: Gavel,
    color: 'from-red-500 to-rose-600',
    textClass: 'text-rose-400',
    bgClass: 'bg-red-500/10 border-red-500/20'
  },
  laboral: {
    id: 'laboral',
    nombre: 'Derecho Laboral',
    descripcion: 'Nueva Ley Procesal del Trabajo y SUNAFIL. Despido arbitrario y beneficios.',
    icon: Briefcase,
    color: 'from-amber-500 to-orange-600',
    textClass: 'text-orange-400',
    bgClass: 'bg-amber-500/10 border-amber-500/20'
  },
  constitucional: {
    id: 'constitucional',
    nombre: 'Constitucional',
    descripcion: 'Procesos de Amparo, Habeas Corpus y Código Procesal Constitucional.',
    icon: ShieldAlert,
    color: 'from-violet-500 to-purple-600',
    textClass: 'text-purple-400',
    bgClass: 'bg-violet-500/10 border-violet-500/20'
  },
  familia: {
    id: 'familia',
    nombre: 'Derecho de Familia',
    descripcion: 'Alimentos, tenencia, violencia familiar (Ley 30364) e impacto emocional.',
    icon: Users,
    color: 'from-pink-500 to-rose-500',
    textClass: 'text-pink-400',
    bgClass: 'bg-pink-500/10 border-pink-500/20'
  },
  administrativo: {
    id: 'administrativo',
    nombre: 'Administrativo',
    descripcion: 'LPAG Ley 27444, silencio administrativo y contencioso-administrativo.',
    icon: Building2,
    color: 'from-emerald-500 to-teal-600',
    textClass: 'text-emerald-400',
    bgClass: 'bg-emerald-500/10 border-emerald-500/20'
  }
};

export default function PanelExpertos() {
  // SEO Dinámico
  useEffect(() => {
    document.title = 'Panel de Expertos Legales IA | LegalPro';
    
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', 'Consulta legal multidisciplinaria en el Perú. Obtén diagnósticos integrados en tiempo real analizados en paralelo por especialistas virtuales y consolidados por un Abogado Master.');

    let metaKey = document.querySelector('meta[name="keywords"]');
    if (!metaKey) {
      metaKey = document.createElement('meta');
      metaKey.setAttribute('name', 'keywords');
      document.head.appendChild(metaKey);
    }
    metaKey.setAttribute('content', 'panel de expertos ia, legalpro, derecho peruano, consulta civil, consulta penal, ncpp peru, casacion civil, sunafil, lpdp');

    return () => {
      document.title = 'LegalPro | Inteligencia Artificial para Abogados';
    };
  }, []);

  // Estados de la aplicación
  const [consulta, setConsulta] = useState('');
  const [autodetectar, setAutodetectar] = useState(true);
  const [especialistasSeleccionados, setEspecialistasSeleccionados] = useState([]);
  
  // Estados del flujo SSE
  const [loading, setLoading] = useState(false);
  const [faseActual, setFaseActual] = useState('idle'); // idle | enrutando | enrutado | analizando | consolidando | completado | error
  const [logs, setLogs] = useState([]);
  const [analistasStatus, setAnalistasStatus] = useState({}); // { [espId]: { status: 'pending'|'analyzing'|'done'|'timeout'|'error', desdeCache: bool } }
  const [diagnosticoMaster, setDiagnosticoMaster] = useState('');
  const [tokensConsumidos, setTokensConsumidos] = useState(null);
  const [errorText, setErrorText] = useState('');
  
  // Utilidades de la UI
  const [copiado, setCopiado] = useState(false);
  const resultadoRef = useRef(null);

  // Auto-scroll al final del diagnóstico en streaming
  useEffect(() => {
    if (faseActual === 'consolidando' && resultadoRef.current) {
      resultadoRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [diagnosticoMaster, faseActual]);

  const toggleEspecialista = (id) => {
    setEspecialistasSeleccionados(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const agregarLog = (mensaje, tipo = 'info') => {
    setLogs(prev => [...prev, { mensaje, tipo, hora: new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) }]);
  };

  // Función para consumir el stream mediante SSE (POST)
  const iniciarAnalisis = async (e) => {
    if (e) e.preventDefault();
    if (!consulta.trim() || loading) return;

    // Resetear estados
    setLoading(true);
    setFaseActual('enrutando');
    setLogs([]);
    setDiagnosticoMaster('');
    setTokensConsumidos(null);
    setErrorText('');

    // Inicializar estados de analistas
    const initialStatus = {};
    if (!autodetectar && especialistasSeleccionados.length > 0) {
      especialistasSeleccionados.forEach(esp => {
        initialStatus[esp] = { status: 'pending', desdeCache: false };
      });
    } else {
      // Si se autodetectará, se inicializarán dinámicamente cuando el router devuelva la lista
      Object.keys(ESPECIALIDADES_INFO).forEach(esp => {
        initialStatus[esp] = { status: 'idle', desdeCache: false };
      });
    }
    setAnalistasStatus(initialStatus);

    agregarLog('Iniciando sistema del Panel de Expertos Multidisciplinario...', 'sys');

    try {
      const token = getToken();
      // Resolver base URL
      const NODE_API = import.meta.env.VITE_NODE_API_URL || '';
      const baseApi = `${NODE_API}/api`;

      const response = await fetch(`${baseApi}/ai/panel-expertos/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          prompt: consulta,
          especialistas: autodetectar ? [] : especialistasSeleccionados,
          disclaimerAceptado: true
        })
      });

      if (!response.ok) {
        const errorBody = await response.json().catch(() => ({}));
        throw new Error(errorBody.error || `Error del servidor (${response.status})`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder('utf-8');

      if (!reader) {
        throw new Error('El navegador no soporta lectura de streams en tiempo real.');
      }

      let buffer = '';
      let analizandoReportado = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Dejar la línea incompleta para la siguiente lectura

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const jsonStr = trimmed.slice(6);
            try {
              const data = JSON.parse(jsonStr);
              
              switch (data.status) {
                case 'enrutando':
                  setFaseActual('enrutando');
                  agregarLog(data.message, 'sys');
                  break;

                case 'enrutado':
                  setFaseActual('enrutado');
                  agregarLog(data.message, 'success');
                  // Inicializar estado para los especialistas autodetectados
                  if (data.especialidades && Array.isArray(data.especialidades)) {
                    const newStatus = {};
                    data.especialidades.forEach(esp => {
                      newStatus[esp] = { status: 'pending', desdeCache: false };
                    });
                    setAnalistasStatus(newStatus);
                  }
                  break;

                case 'analizando':
                  setFaseActual('analizando');
                  if (!analizandoReportado) {
                    agregarLog(data.message, 'sys');
                    analizandoReportado = true;
                  }
                  break;

                case 'analizando_especialista':
                  if (data.especialista) {
                    setAnalistasStatus(prev => ({
                      ...prev,
                      [data.especialista]: { status: 'analyzing', desdeCache: false }
                    }));
                    agregarLog(data.message, 'info');
                  }
                  break;

                case 'especialista_completado':
                  if (data.especialista) {
                    setAnalistasStatus(prev => ({
                      ...prev,
                      [data.especialista]: {
                        status: data.timeout ? 'timeout' : 'done',
                        desdeCache: data.desdeCache || false
                      }
                    }));
                    agregarLog(data.message, data.timeout ? 'warn' : 'success');
                  }
                  break;

                case 'analistas_completados':
                  agregarLog(data.message, 'success');
                  break;

                case 'consolidando':
                  setFaseActual('consolidando');
                  agregarLog(data.message, 'sys');
                  break;

                case 'chunk':
                  if (data.chunk) {
                    setDiagnosticoMaster(prev => prev + data.chunk);
                  }
                  break;

                case 'done':
                  setFaseActual('completado');
                  setLoading(false);
                  if (data.tokens) {
                    setTokensConsumidos(data.tokens);
                  }
                  agregarLog('Análisis multidisciplinario consolidado con éxito.', 'success');
                  break;

                case 'error':
                  throw new Error(data.error || 'Ocurrió un error en el procesamiento.');

                default:
                  break;
              }
            } catch (err) {
              console.error('Error parseando SSE chunk:', err);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error en el consumo de SSE:', err);
      setFaseActual('error');
      setLoading(false);
      setErrorText(err.message || 'Error de conexión con el servidor.');
      agregarLog(`Error: ${err.message || 'Error en el sistema'}`, 'error');
    }
  };

  const copiarAlPortapapeles = () => {
    if (!diagnosticoMaster) return;
    navigator.clipboard.writeText(diagnosticoMaster)
      .then(() => {
        setCopiado(true);
        setTimeout(() => setCopiado(false), 2000);
      });
  };

  const resetearTodo = () => {
    setConsulta('');
    setAutodetectar(true);
    setEspecialistasSeleccionados([]);
    setFaseActual('idle');
    setLogs([]);
    setAnalistasStatus({});
    setDiagnosticoMaster('');
    setTokensConsumidos(null);
    setErrorText('');
    setLoading(false);
  };

  // Función simple para renderizar Markdown a elementos React con estilos premium de Tailwind
  const renderMarkdown = (text) => {
    if (!text) return null;
    
    // Auxiliar para parsear negritas **texto**
    const parseInline = (txt) => {
      const parts = txt.split(/(\*\*.*?\*\*)/);
      return parts.map((part, idx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return <strong key={idx} className="font-bold text-white text-shadow-sm">{part.slice(2, -2)}</strong>;
        }
        return part;
      });
    };

    const paragraphs = text.split('\n\n');
    return paragraphs.map((para, i) => {
      let trimmed = para.trim();
      if (!trimmed) return null;
      
      // Encabezados H2, H3, H4
      if (trimmed.startsWith('### ')) {
        return <h4 key={i} className="text-md font-bold text-blue-400 mt-4 mb-2 tracking-wide uppercase">{parseInline(trimmed.slice(4))}</h4>;
      }
      if (trimmed.startsWith('## ')) {
        return <h3 key={i} className="text-lg font-bold text-indigo-300 mt-5 mb-2.5 border-b border-white/5 pb-1">{parseInline(trimmed.slice(3))}</h3>;
      }
      if (trimmed.startsWith('# ')) {
        return <h2 key={i} className="text-xl font-extrabold text-white mt-6 mb-3 tracking-tight">{parseInline(trimmed.slice(2))}</h2>;
      }
      
      // Listas Desordenadas
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        const items = trimmed.split(/\n[-*]\s+/);
        if (items[0].startsWith('- ') || items[0].startsWith('* ')) {
          items[0] = items[0].slice(2);
        }
        return (
          <ul key={i} className="list-disc list-inside space-y-2 my-3 text-slate-300 pl-2">
            {items.map((itemStr, idx) => (
              <li key={idx} className="text-sm leading-relaxed">{parseInline(itemStr)}</li>
            ))}
          </ul>
        );
      }
      
      // Listas Ordenadas
      if (/^\d+\.\s+/.test(trimmed)) {
        const items = trimmed.split(/\n\d+\.\s+/);
        if (/^\d+\.\s+/.test(items[0])) {
          items[0] = items[0].replace(/^\d+\.\s+/, '');
        }
        return (
          <ol key={i} className="list-decimal list-inside space-y-2 my-3 text-slate-300 pl-2">
            {items.map((itemStr, idx) => (
              <li key={idx} className="text-sm leading-relaxed">{parseInline(itemStr)}</li>
            ))}
          </ol>
        );
      }

      // Advertencias Especiales de la Realidad Peruana (Personalizado)
      const esAdvertencia = trimmed.toLowerCase().includes('advertencia') || trimmed.toLowerCase().includes('riesgo sistémico');
      
      // Párrafos generales
      const lines = trimmed.split('\n');
      return (
        <div key={i} className={`p-3 rounded-xl my-3 ${esAdvertencia ? 'bg-orange-500/10 border border-orange-500/25 text-orange-200' : 'bg-transparent text-slate-300'}`}>
          {lines.map((line, idx) => (
            <p key={idx} className="text-sm leading-relaxed">
              {parseInline(line)}
            </p>
          ))}
        </div>
      );
    });
  };

  return (
    <main className="page-enter flex flex-col h-[calc(100dvh-148px)] lg:h-[calc(100dvh-64px)] overflow-hidden bg-[#0a0a0f] text-slate-100">
      {/* Header optimizado semánticamente */}
      <Header
        title="Panel de Expertos Multidisciplinario"
        showBack
        rightAction={
          <span className="badge bg-indigo-500/10 text-indigo-400 border border-indigo-500/25 text-xs font-bold py-1 px-2.5 rounded-full flex items-center gap-1">
            <Sparkles size={13} className="animate-pulse" /> Fase 7 Pro
          </span>
        }
      />

      <div className="flex-1 overflow-y-auto px-4 py-4 lg:py-6 max-w-5xl mx-auto w-full space-y-6">
        {/* Banner de descargo legal peruano obligatorio (Ley N° 29733 y principios de IA) */}
        <section aria-label="Aviso Legal de IA">
          <IADisclaimerBanner compact />
        </section>

        <AnimatePresence mode="wait">
          {faseActual === 'idle' ? (
            /* ================= FASE INICIAL: CONFIGURACIÓN ================= */
            <motion.section
              key="setup"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -15 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
              aria-labelledby="setup-title"
            >
              <div className="text-center max-w-2xl mx-auto space-y-2">
                <h1 id="setup-title" className="text-xl lg:text-3xl font-extrabold text-white tracking-tight bg-linear-to-r from-blue-400 via-indigo-200 to-purple-400 bg-clip-text text-transparent">
                  Consulta de Alta Complejidad Legal
                </h1>
                <p className="text-xs lg:text-sm text-slate-400 leading-relaxed">
                  Envía tu caso y activa un debate en paralelo entre especialistas de IA del derecho peruano. Obtendrás un diagnóstico unificado estratégico y alertas procesales de la realidad judicial.
                </p>
              </div>

              <form onSubmit={iniciarAnalisis} className="space-y-6 bg-white/5 border border-white/8 p-5 lg:p-6 rounded-3xl backdrop-blur-xl shadow-2xl">
                {/* Textarea de Consulta */}
                <div className="space-y-2">
                  <label htmlFor="consulta-legal" className="block text-xs lg:text-sm font-bold text-slate-200">
                    Consulta o Hechos del Caso
                  </label>
                  <textarea
                    id="consulta-legal"
                    required
                    rows={6}
                    maxLength={5000}
                    className="w-full bg-[#050508]/60 border border-white/10 rounded-2xl p-4 text-sm placeholder:text-slate-500 focus:outline-hidden focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all duration-300 resize-none text-white leading-relaxed"
                    placeholder="Describe de forma detallada el caso peruano. Ej: Un trabajador del régimen 728 fue despedido de forma intempestiva hace 20 días hábiles sin imputación de falta grave..."
                    value={consulta}
                    onChange={(e) => setConsulta(e.target.value)}
                  />
                  <div className="flex justify-between items-center text-[11px] text-slate-500">
                    <span>Cita plazos, artículos o nombres para un análisis más riguroso.</span>
                    <span>{consulta.length}/5000 caract.</span>
                  </div>
                </div>

                {/* Switch de Modo de Selección */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 bg-white/3 rounded-2xl border border-white/5">
                  <div>
                    <h2 className="text-xs lg:text-sm font-bold text-white">Método de Enrutamiento</h2>
                    <p className="text-[11px] text-slate-400">Determina qué especialistas virtuales intervienen en el análisis.</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      id="btn-route-auto"
                      onClick={() => setAutodetectar(true)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 ${autodetectar ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Autodetectar IA
                    </button>
                    <button
                      type="button"
                      id="btn-route-manual"
                      onClick={() => setAutodetectar(false)}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all duration-200 ${!autodetectar ? 'bg-indigo-500 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      Selección Manual
                    </button>
                  </div>
                </div>

                {/* Listado de Especialistas Manuales */}
                <AnimatePresence>
                  {!autodetectar && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3 overflow-hidden"
                    >
                      <h3 className="text-xs lg:text-sm font-bold text-slate-300">Selecciona al menos un especialista:</h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {Object.values(ESPECIALIDADES_INFO).map((esp) => {
                          const IconComp = esp.icon;
                          const isSelected = especialistasSeleccionados.includes(esp.id);
                          return (
                            <button
                              key={esp.id}
                              type="button"
                              id={`select-esp-${esp.id}`}
                              onClick={() => toggleEspecialista(esp.id)}
                              className={`flex items-start gap-3 p-3 rounded-2xl border text-left transition-all duration-300
                                ${isSelected
                                  ? `${esp.bgClass} border-indigo-500/40 ring-1 ring-indigo-500/20`
                                  : 'bg-white/3 border-white/5 hover:border-white/12 hover:bg-white/5'}`}
                            >
                              <div className={`p-2 rounded-xl bg-linear-to-br ${esp.color} text-white shrink-0 shadow-md`}>
                                <IconComp size={16} />
                              </div>
                              <div>
                                <h4 className="text-xs font-bold text-white">{esp.nombre}</h4>
                                <p className="text-[10px] text-slate-400 mt-0.5 leading-snug">{esp.descripcion}</p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Botón de Envío */}
                <div className="pt-2">
                  <button
                    type="submit"
                    id="btn-enviar-consulta"
                    disabled={!consulta.trim() || (!autodetectar && especialistasSeleccionados.length === 0)}
                    className="w-full py-3.5 px-6 rounded-2xl font-bold text-sm tracking-wide text-white
                      bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500
                      disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 shadow-xl
                      flex items-center justify-center gap-2 group border border-white/10 hover:shadow-indigo-500/20"
                  >
                    <span>Analizar Caso Complejo</span>
                    <Send size={15} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </form>
            </motion.section>
          ) : (
            /* ================= FASE DE PROCESO Y DIAGNÓSTICO ================= */
            <motion.div
              key="processing"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.98 }}
              className="space-y-6"
            >
              {/* Botón de retroceso */}
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  id="btn-volver-atras"
                  onClick={resetearTodo}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
                >
                  <ArrowLeft size={14} />
                  <span>Configurar nueva consulta</span>
                </button>
                {tokensConsumidos && (
                  <span className="text-[11px] text-indigo-400 font-semibold bg-indigo-500/10 px-2 py-0.5 border border-indigo-500/15 rounded-full flex items-center gap-1">
                    <Database size={11} /> {tokensConsumidos} tokens consumidos
                  </span>
                )}
              </div>

              {/* Status Tracker Global */}
              <section aria-label="Progreso del Análisis" className="bg-white/5 border border-white/8 rounded-3xl p-5 lg:p-6 backdrop-blur-xl space-y-4">
                <div className="flex items-center gap-3">
                  {loading ? (
                    <Loader2 className="animate-spin text-indigo-400" size={20} />
                  ) : faseActual === 'completado' ? (
                    <CheckCircle2 className="text-emerald-400" size={20} />
                  ) : (
                    <AlertCircle className="text-red-400" size={20} />
                  )}
                  <div>
                    <h2 className="text-xs lg:text-sm font-bold text-white uppercase tracking-wider">
                      {faseActual === 'enrutando' && 'Enrutando Caso...'}
                      {faseActual === 'enrutado' && 'Materia Clasificada'}
                      {faseActual === 'analizando' && 'Análisis en Paralelo Activo'}
                      {faseActual === 'consolidando' && 'Master unificando estrategia...'}
                      {faseActual === 'completado' && 'Diagnóstico Final Terminado'}
                      {faseActual === 'error' && 'Error en el Procesamiento'}
                    </h2>
                    <p className="text-[11px] text-slate-400">
                      {faseActual === 'enrutando' && 'El router IA está determinando qué materias del derecho se ven afectadas.'}
                      {faseActual === 'enrutado' && 'Especialidades identificadas. Desplegando agentes expertos.'}
                      {faseActual === 'analizando' && 'Los especialistas virtuales están evaluando plazos y legislación aplicable.'}
                      {faseActual === 'consolidando' && 'Generando reporte estructurado de plazos y plan de acción legal.'}
                      {faseActual === 'completado' && 'El diagnóstico ya está disponible. Revisa las advertencias críticas del sistema.'}
                      {faseActual === 'error' && 'No se pudo completar el análisis del panel de expertos.'}
                    </p>
                  </div>
                </div>

                {/* Panel de Especialistas Virtuales (Fase 6 & 7) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
                  {Object.keys(analistasStatus).map((espId) => {
                    const info = ESPECIALIDADES_INFO[espId];
                    if (!info) return null;
                    const state = analistasStatus[espId];
                    const IconComp = info.icon;
                    
                    return (
                      <div
                        key={espId}
                        className={`flex flex-col items-center justify-center p-3 rounded-2xl border text-center transition-all duration-300
                          ${state.status === 'analyzing' ? 'bg-indigo-500/10 border-indigo-500/40 animate-pulse' : ''}
                          ${state.status === 'done' ? 'bg-emerald-500/5 border-emerald-500/20' : ''}
                          ${state.status === 'timeout' ? 'bg-orange-500/5 border-orange-500/20' : ''}
                          ${state.status === 'pending' || state.status === 'idle' ? 'bg-white/3 border-white/5 opacity-55' : ''}
                        `}
                      >
                        <div className={`p-2 rounded-xl bg-linear-to-br ${info.color} text-white mb-2 shadow-md relative`}>
                          <IconComp size={15} />
                          {state.status === 'done' && (
                            <span className="absolute -top-1.5 -right-1.5 bg-emerald-500 text-white rounded-full p-0.5 border border-surface shadow-xs">
                              <CheckCircle2 size={9} />
                            </span>
                          )}
                          {state.status === 'timeout' && (
                            <span className="absolute -top-1.5 -right-1.5 bg-orange-500 text-white rounded-full p-0.5 border border-surface shadow-xs">
                              <Clock size={9} />
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] font-bold text-white truncate max-w-full">{info.nombre}</span>
                        
                        {/* Estado detallado */}
                        <div className="mt-1.5 flex flex-col gap-0.5">
                          {state.status === 'analyzing' && (
                            <span className="text-[9px] text-indigo-400 font-semibold flex items-center gap-0.5">
                              <Loader2 size={8} className="animate-spin" /> Analizando
                            </span>
                          )}
                          {state.status === 'done' && (
                            <span className="text-[9px] text-emerald-400 font-semibold flex items-center justify-center gap-0.5">
                              Listo {state.desdeCache && <span className="bg-blue-500/20 text-blue-300 text-[8px] px-1 rounded-sm">Caché</span>}
                            </span>
                          )}
                          {state.status === 'timeout' && (
                            <span className="text-[9px] text-orange-400 font-semibold" title="Utilizó el fallback local de contingencia">
                              Fallback
                            </span>
                          )}
                          {(state.status === 'pending' || state.status === 'idle') && (
                            <span className="text-[9px] text-slate-500">
                              {state.status === 'pending' ? 'En espera' : 'Inactivo'}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Contenedor del Diagnóstico y Consolidación (Streaming) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Columna Principal: Consolidación (Markdown) */}
                <section aria-labelledby="diagnosis-title" className="lg:col-span-2 space-y-4">
                  <div className="bg-white/5 border border-white/8 rounded-3xl p-5 lg:p-6 backdrop-blur-xl min-h-[400px] flex flex-col justify-between shadow-2xl relative">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between border-b border-white/5 pb-3">
                        <div className="flex items-center gap-2">
                          <Brain className="text-indigo-400" size={18} />
                          <h2 id="diagnosis-title" className="text-sm font-bold text-white tracking-wide uppercase">Diagnóstico Master Consolidado</h2>
                        </div>
                        {diagnosticoMaster && (
                          <button
                            type="button"
                            id="btn-copiar-diagnostico"
                            onClick={copiarAlPortapapeles}
                            className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/15 py-1.5 px-3 rounded-xl border border-indigo-500/20 transition-all duration-200"
                          >
                            {copiado ? <Check size={12} /> : <Copy size={12} />}
                            <span>{copiado ? 'Copiado' : 'Copiar Reporte'}</span>
                          </button>
                        )}
                      </div>

                      {/* Visor de Markdown con Auto-scroll */}
                      <div className="prose prose-invert max-w-none text-slate-300 font-sans tracking-wide">
                        {diagnosticoMaster ? (
                          renderMarkdown(diagnosticoMaster)
                        ) : faseActual === 'consolidando' ? (
                          <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-sm gap-2">
                            <Loader2 className="animate-spin text-indigo-400" size={24} />
                            <p className="animate-pulse">Consolidador Master escribiendo informe legal...</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center justify-center py-16 text-slate-500 text-sm gap-2">
                            <Brain size={32} className="opacity-30" />
                            <p>Esperando la resolución de los analistas...</p>
                          </div>
                        )}
                        <div ref={resultadoRef} />
                      </div>
                    </div>

                    {/* Disclaimer local al pie */}
                    <div className="border-t border-white/5 pt-4 mt-6 text-[10px] text-slate-500 leading-relaxed flex items-start gap-1.5">
                      <AlertCircle size={12} className="shrink-0 text-slate-400 mt-0.5" />
                      <p>
                        Este informe consolida análisis de modelos de lenguaje basados en las normas del ordenamiento jurídico peruano. De conformidad con la LPDP (Ley N° 29733), toda información y propuesta debe ser evaluada por un colegiado profesional.
                      </p>
                    </div>
                  </div>
                </section>

                {/* Columna Lateral: Bitácora del Sistema (Logs) */}
                <section aria-labelledby="logs-title" className="space-y-4">
                  <div className="bg-white/5 border border-white/8 rounded-3xl p-5 backdrop-blur-xl flex flex-col h-full max-h-[550px] shadow-2xl">
                    <h2 id="logs-title" className="text-xs font-bold text-white uppercase tracking-wider border-b border-white/5 pb-2.5 flex items-center gap-1.5">
                      <Sliders size={14} className="text-slate-400" /> Bitácora de Procesamiento
                    </h2>
                    
                    <div className="flex-1 overflow-y-auto mt-3 space-y-2.5 pr-1 font-mono text-[10.5px] scrollbar-thin">
                      {logs.map((log, idx) => (
                        <div key={idx} className="flex flex-col gap-0.5 border-l border-white/8 pl-2 pb-1.5 last:pb-0">
                          <span className="text-[9px] text-slate-500">{log.hora}</span>
                          <span className={`leading-relaxed
                            ${log.tipo === 'error' ? 'text-red-400' : ''}
                            ${log.tipo === 'success' ? 'text-emerald-400' : ''}
                            ${log.tipo === 'sys' ? 'text-indigo-400 font-semibold' : ''}
                            ${log.tipo === 'warn' ? 'text-orange-400' : ''}
                            ${log.tipo === 'info' ? 'text-slate-300' : ''}
                          `}>
                            {log.mensaje}
                          </span>
                        </div>
                      ))}
                      {loading && (
                        <div className="flex items-center gap-1.5 text-[10px] text-slate-500 pl-2 animate-pulse mt-2">
                          <Loader2 size={10} className="animate-spin" />
                          <span>Escuchando eventos en tiempo real...</span>
                        </div>
                      )}
                    </div>

                    <button
                      type="button"
                      id="btn-reiniciar-sistema"
                      onClick={resetearTodo}
                      disabled={loading}
                      className="mt-4 w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 border border-white/8 hover:border-white/12 text-slate-300 hover:text-white transition-all duration-300 flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <RefreshCw size={13} />
                      <span>Nueva Consulta</span>
                    </button>
                  </div>
                </section>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
