import { useState } from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Newspaper, TrendingUp, Scale, BookOpen, Building2, Briefcase, ExternalLink } from 'lucide-react'

const areas = [
  { id: 'todos', label: 'Todos' },
  { id: 'penal', label: 'Penal', icon: Scale },
  { id: 'civil', label: 'Civil', icon: Building2 },
  { id: 'laboral', label: 'Laboral', icon: Briefcase },
  { id: 'constitucional', label: 'Constitucional', icon: BookOpen },
]

const noticias = [
  {
    id: 1,
    area: 'penal',
    areaLabel: 'Penal',
    areaColor: '#EF4444',
    organismo: 'Corte Suprema',
    fecha: '22 Jul 2025',
    titulo: 'R.N. 2301-2025 — Corte Suprema precisa estándar probatorio en lavado de activos',
    resumen: 'La Sala Penal Permanente establece que para condena por lavado de activos se requiere prueba de la actividad criminal precedente más allá de inferencia razonable. Caso precedente.',
    impacto: 'Defensas que invoquen ausencia de actividad precedente acreditada tendrán mayor soporte jurisprudencial.',
    tags: ['Lavado activos', 'Art. 1 D.Leg. 1106', 'Prueba indiciaria'],
    relevancia: 98,
  },
  {
    id: 2,
    area: 'constitucional',
    areaLabel: 'Constitucional',
    areaColor: '#7C3AED',
    organismo: 'Tribunal Constitucional',
    fecha: '18 Jul 2025',
    titulo: 'STC 0012-2024-PHC — TC refuerza derecho a no autoincriminación en investigaciones fiscales',
    resumen: 'El TC en pleno recuerda que el art. 2.24.h de la Constitución protege la no autoincriminación incluso en fases preliminares de investigación fiscal.',
    impacto: 'Imputados en etapa preparatoria del NCPP pueden invocar esta sentencia para objetar requerimientos de declaración.',
    tags: ['Art. 2.24.h Const.', 'NCPP', 'Investigación preparatoria'],
    relevancia: 95,
  },
  {
    id: 3,
    area: 'laboral',
    areaLabel: 'Laboral',
    areaColor: '#10B981',
    organismo: 'Corte Suprema',
    fecha: '15 Jul 2025',
    titulo: 'Cas. Lab. 3401-2025-Lima — Nueva regla de reposición en plazo razonable',
    resumen: 'La Sala Constitucional y Social Permanente establece que la reposición laboral debe ejecutarse en un plazo máximo de 30 días hábiles desde la sentencia firme.',
    impacto: 'Trabajadores con sentencias de reposición pueden exigir ejecución inmediata bajo apercibimiento de multas.',
    tags: ['NLPT', 'Reposición', 'Ejecución sentencia'],
    relevancia: 89,
  },
  {
    id: 4,
    area: 'civil',
    areaLabel: 'Civil',
    areaColor: '#00E5FF',
    organismo: 'Corte Suprema',
    fecha: '10 Jul 2025',
    titulo: 'Cas. 4502-2025-Lima — Prescripción adquisitiva: requisitos de posesión continua reinterpretados',
    resumen: 'La Sala Civil Permanente aclara que la posesión continua exigida por el art. 950 CC admite interrupciones por fuerza mayor sin afectar el cómputo del plazo decenal.',
    impacto: 'Procesos de usucapión con interrupciones atribuibles a fuerza mayor tienen mayor viabilidad procesal.',
    tags: ['Art. 950 CC', 'Usucapión', 'Posesión continua'],
    relevancia: 85,
  },
  {
    id: 5,
    area: 'penal',
    areaLabel: 'Penal',
    areaColor: '#EF4444',
    organismo: 'Tribunal Constitucional',
    fecha: '05 Jul 2025',
    titulo: 'STC 0009-2024-PHC — Ampliación de plazo de detención requiere motivación reforzada',
    resumen: 'El TC precisa que toda resolución que amplíe el plazo de detención preliminar más allá de las 72 horas exige motivación específica y proporcional a la gravedad del imputado.',
    impacto: 'Habeas corpus por detención arbitraria tienen mayor fundamento cuando la motivación de ampliación es genérica.',
    tags: ['Art. 264 NCPP', 'Detención preliminar', 'Habeas corpus'],
    relevancia: 92,
  },
  {
    id: 6,
    area: 'laboral',
    areaLabel: 'Laboral',
    areaColor: '#10B981',
    organismo: 'Corte Suprema',
    fecha: '02 Jul 2025',
    titulo: 'Cas. Lab. 2890-2025 — CTS: bonificaciones regulares se incluyen en remuneración computable',
    resumen: 'La Sala Laboral Permanente confirma que bonificaciones pagadas por más de tres meses consecutivos integran la remuneración computable para el cálculo de la CTS.',
    impacto: 'Trabajadores con bonificaciones recurrentes pueden reclamar diferencias de CTS no calculadas correctamente.',
    tags: ['CTS', 'D.Leg. 650', 'Remuneración computable'],
    relevancia: 87,
  },
]

export default function JurisprudenciaFeed() {
  const [areaActiva, setAreaActiva] = useState('todos')
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.05 })

  const filtradas = areaActiva === 'todos' ? noticias : noticias.filter((n) => n.area === areaActiva)

  return (
    <section ref={ref} id="jurisprudencia-feed" className="relative py-24 overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #0A0F2E 0%, #050A1E 100%)' }} />
      <div className="absolute top-0 left-1/4 w-[600px] h-[400px] rounded-full opacity-8 blur-[140px]"
        style={{ background: 'radial-gradient(ellipse, #7C3AED 0%, transparent 70%)' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }}
          className="text-center mb-12">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.35)', color: '#A78BFA' }}>
            <Newspaper size={14} /> Jurisprudencia del Día
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Lex.ia monitorea el <span style={{ color: '#A78BFA' }}>Poder Judicial</span> por ti
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Nuevas sentencias, plenos casatorios y acuerdos plenarios — analizados automáticamente con impacto en tu práctica diaria.
          </p>
        </motion.div>

        {/* Filtros */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.1, duration: 0.5 }}
          className="flex flex-wrap justify-center gap-3 mb-10">
          {areas.map((a) => {
            const Icon = a.icon
            return (
              <button
                key={a.id}
                onClick={() => setAreaActiva(a.id)}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
                style={{
                  background: areaActiva === a.id ? 'rgba(167,139,250,0.15)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${areaActiva === a.id ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.09)'}`,
                  color: areaActiva === a.id ? '#A78BFA' : '#94A3B8',
                }}>
                {Icon && <Icon size={13} />}
                {a.label}
              </button>
            )
          })}
        </motion.div>

        {/* Grid de noticias */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtradas.map((n, i) => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 30 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.07, duration: 0.5 }}
              whileHover={{ y: -4 }}
              className="flex flex-col p-5 rounded-2xl cursor-default"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
            >
              {/* Area + Organismo */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: `${n.areaColor}15`, color: n.areaColor }}>
                    {n.areaLabel}
                  </span>
                  <span className="text-xs text-slate-500">{n.organismo}</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: n.relevancia >= 90 ? '#10B981' : '#F59E0B' }} />
                  <span className="text-xs font-semibold" style={{ color: n.relevancia >= 90 ? '#10B981' : '#F59E0B' }}>
                    {n.relevancia}%
                  </span>
                </div>
              </div>

              {/* Fecha */}
              <p className="text-xs text-slate-500 mb-2">{n.fecha}</p>

              {/* Titulo */}
              <h3 className="text-sm font-bold text-white leading-tight mb-3">{n.titulo}</h3>

              {/* Resumen */}
              <p className="text-xs text-slate-400 leading-relaxed mb-3 flex-grow">{n.resumen}</p>

              {/* Impacto IA */}
              <div className="p-3 rounded-xl mb-3" style={{ background: 'rgba(0,229,255,0.06)', border: '1px solid rgba(0,229,255,0.12)' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <TrendingUp size={12} color="#00E5FF" />
                  <span className="text-xs font-semibold" style={{ color: '#00E5FF' }}>Impacto en tu práctica</span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">{n.impacto}</p>
              </div>

              {/* Tags */}
              <div className="flex flex-wrap gap-1.5">
                {n.tags.map((t) => (
                  <span key={t} className="text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: '#64748B' }}>
                    {t}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Footer CTA */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.5, duration: 0.5 }}
          className="text-center mt-12">
          <p className="text-slate-500 text-sm mb-4">
            Lex.ia monitorea <span className="text-white font-semibold">+850 resoluciones</span> del TC, Corte Suprema y SUNARP cada semana
          </p>
          <div className="flex flex-wrap justify-center gap-6 text-sm text-slate-400">
            <span className="flex items-center gap-2"><ExternalLink size={14} color="#A78BFA" /> Integrado con SINOE</span>
            <span className="flex items-center gap-2"><ExternalLink size={14} color="#10B981" /> Conectado al CEJ</span>
            <span className="flex items-center gap-2"><ExternalLink size={14} color="#00E5FF" /> Alertas personalizadas</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
