import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { ShieldCheck, Star, Quote, CheckCircle, XCircle, Award } from 'lucide-react'

const testimonios = [
  {
    nombre: 'Dr. Carlos Mendoza R.',
    cargo: 'Abogado Penalista — Lima',
    colegiatura: 'CAL N° 34.872',
    foto: 'CM',
    texto: 'Lex.ia me ahorra 4 horas diarias en investigación. La semana pasada encontró un precedente del TC que cambió completamente mi estrategia de defensa. Mis colegas no pueden creer cómo preparo los casos ahora.',
    rating: 5,
    especialidad: 'Derecho Penal (NCPP)',
    color: '#EF4444',
  },
  {
    nombre: 'Dra. Patricia Vásquez L.',
    cargo: 'Abogada Laboralista — Arequipa',
    colegiatura: 'CAA N° 8.231',
    foto: 'PV',
    texto: 'Uso Lex.ia en todos mis casos de despido arbitrario. El análisis de jurisprudencia casatoria es impresionante — me mostró tendencias que no había visto en 12 años de ejercicio. Imprescindible.',
    rating: 5,
    especialidad: 'Derecho Laboral (LPCL)',
    color: '#10B981',
  },
  {
    nombre: 'Dr. Roberto Quispe V.',
    cargo: 'Fiscal Adjunto Provincial — Cusco',
    colegiatura: 'MP — Reg. 2.456',
    foto: 'RQ',
    texto: 'El predictor de sentencias penales es de una precisión asombrosa. He podido estimar correctamente el resultado en 18 de mis últimos 20 requerimientos. Lex.ia entiende el NCPP como pocos.',
    rating: 5,
    especialidad: 'Fiscalía Penal Especializada',
    color: '#00E5FF',
  },
]

const comparacion = [
  { feature: 'Jurisprudencia peruana actualizada', lexia: true, tradicional: false },
  { feature: 'Análisis NCPP / CPC / LPCL', lexia: true, tradicional: false },
  { feature: 'Predicción de resultado judicial', lexia: true, tradicional: false },
  { feature: 'Integración SINOE + CEJ', lexia: true, tradicional: false },
  { feature: 'Redacción de escritos legales', lexia: true, tradicional: false },
  { feature: 'Simulador de juicios interactivo', lexia: true, tradicional: false },
  { feature: 'Plazos procesales automáticos', lexia: true, tradicional: true },
  { feature: 'Plantillas de documentos', lexia: true, tradicional: true },
]

const certificaciones = [
  { label: 'Validado con 1,000+ casos reales', sub: 'Precisión del 95% verificada', color: '#10B981', icon: ShieldCheck },
  { label: 'Entrenado con legislación oficial', sub: 'Diario El Peruano + SPIJ', color: '#00E5FF', icon: Award },
  { label: 'Compatible con CAL y CAA', sub: 'Colegios de Abogados del Perú', color: '#A78BFA', icon: CheckCircle },
]

function AvatarLetras({ letras, color }) {
  return (
    <div className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-extrabold flex-shrink-0"
      style={{ background: `${color}20`, border: `2px solid ${color}40`, color }}>
      {letras}
    </div>
  )
}

export default function ValidacionLegal() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.05 })

  return (
    <section ref={ref} id="validacion-legal" className="relative py-24 overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #0D1545 0%, #111B5E 50%, #0A0F2E 100%)' }} />
      <div className="absolute top-1/2 left-0 w-[600px] h-[600px] rounded-full opacity-10 blur-[140px] -translate-y-1/2"
        style={{ background: 'radial-gradient(ellipse, #10B981 0%, transparent 70%)' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }}
          className="text-center mb-16">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
            style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10B981' }}>
            <ShieldCheck size={14} /> Validación Legal
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Confiado por <span style={{ color: '#10B981' }}>abogados reales</span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Lex.ia no es una herramienta genérica — fue construida con y para abogados peruanos que ejercen en el día a día.
          </p>
        </motion.div>

        {/* Certificaciones */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.1, duration: 0.5 }}
          className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-16">
          {certificaciones.map((c, i) => {
            const CIcon = c.icon
            return (
              <motion.div key={c.label}
                initial={{ opacity: 0, y: 20 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.1 + i * 0.1 }}
                className="flex items-center gap-4 p-5 rounded-2xl"
                style={{ background: `${c.color}08`, border: `1px solid ${c.color}25` }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `${c.color}15` }}>
                  <CIcon size={20} color={c.color} />
                </div>
                <div>
                  <p className="text-sm font-bold text-white">{c.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{c.sub}</p>
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Testimonios */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          {testimonios.map((t, i) => (
            <motion.div key={t.nombre}
              initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.2 + i * 0.12, duration: 0.5 }}
              whileHover={{ y: -4 }}
              className="flex flex-col p-6 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <Quote size={28} color={t.color} className="mb-4 opacity-60" />
              <p className="text-sm text-slate-300 leading-relaxed flex-grow mb-5">{t.texto}</p>
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-1">
                  {Array.from({ length: t.rating }).map((_, j) => (
                    <Star key={j} size={14} fill={t.color} color={t.color} />
                  ))}
                </div>
                <span className="text-xs px-2 py-0.5 rounded" style={{ background: `${t.color}15`, color: t.color }}>{t.especialidad}</span>
              </div>
              <div className="flex items-center gap-3">
                <AvatarLetras letras={t.foto} color={t.color} />
                <div>
                  <p className="text-sm font-bold text-white">{t.nombre}</p>
                  <p className="text-xs text-slate-400">{t.cargo}</p>
                  <p className="text-xs font-mono mt-0.5" style={{ color: t.color }}>{t.colegiatura}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Comparación */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.4, duration: 0.6 }}>
          <h3 className="text-2xl font-bold text-white text-center mb-8" style={{ fontFamily: 'Space Grotesk' }}>
            Lex.ia vs. herramientas <span style={{ color: '#A78BFA' }}>tradicionales</span>
          </h3>
          <div className="max-w-2xl mx-auto rounded-2xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.09)' }}>
            {/* Header tabla */}
            <div className="grid grid-cols-3 text-center text-sm font-bold py-4 px-6"
              style={{ background: 'rgba(255,255,255,0.04)' }}>
              <p className="text-left text-slate-400">Funcionalidad</p>
              <p style={{ color: '#00E5FF' }}>Lex.ia</p>
              <p className="text-slate-500">Otras herramientas</p>
            </div>
            {/* Filas */}
            {comparacion.map((row, i) => (
              <div key={row.feature}
                className="grid grid-cols-3 items-center py-3 px-6 text-sm"
                style={{ 
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  borderTop: '1px solid rgba(255,255,255,0.04)' 
                }}>
                <p className="text-slate-300 text-xs">{row.feature}</p>
                <div className="flex justify-center">
                  <CheckCircle size={18} color="#10B981" fill="rgba(16,185,129,0.15)" />
                </div>
                <div className="flex justify-center">
                  {row.tradicional
                    ? <CheckCircle size={18} color="#64748B" fill="rgba(100,116,139,0.1)" />
                    : <XCircle size={18} color="#EF4444" fill="rgba(239,68,68,0.1)" />
                  }
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
