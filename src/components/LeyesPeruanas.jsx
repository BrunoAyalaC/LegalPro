import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { BookOpen, Scale, Gavel, FileText, Building2, Landmark } from 'lucide-react'

const codigos = [
  {
    icon: Gavel,
    name: 'Código Penal',
    abbr: 'CP',
    year: '1991',
    arts: '490 artículos',
    desc: 'Delitos y penas. Arts. 106–440 (parte especial). Homicidio, estafa, corrupción, tráfico ilícito.',
    color: '#EF4444',
    articulos: ['Art. 106 - Homicidio', 'Art. 185 - Hurto', 'Art. 196 - Estafa', 'Art. 393 - Corrupción'],
  },
  {
    icon: Scale,
    name: 'Código Procesal Civil',
    abbr: 'CPC',
    year: '1993',
    arts: '840 artículos',
    desc: 'Proceso de conocimiento, abreviado, sumarísimo y cautelar. Plazos y notificaciones.',
    color: '#00E5FF',
    articulos: ['Art. 1 - Derecho a la tutela', 'Art. 100 - Plazos', 'Art. 424 - Demanda', 'Art. 478 - Proceso conocimiento'],
  },
  {
    icon: FileText,
    name: 'Nuevo Código Procesal Penal',
    abbr: 'NCPP',
    year: '2004',
    arts: '566 artículos',
    desc: 'Sistema acusatorio. Investigación, juzgamiento y recursos. Nulidades procesales.',
    color: '#7C3AED',
    articulos: ['Art. 71 - Derechos imputado', 'Art. 122 - Resoluciones', 'Art. 268 - Prisión preventiva', 'Art. 352 - Saneamiento'],
  },
  {
    icon: BookOpen,
    name: 'Ley N° 30364',
    abbr: 'VF',
    year: '2015',
    arts: 'Violencia Familiar',
    desc: 'Protección frente a la violencia familiar y de género. Medidas de protección y sanciones.',
    color: '#F59E0B',
    articulos: ['Art. 8 - Tipos de violencia', 'Art. 16 - Medidas de protección', 'Art. 22 - Medidas cautelares', 'Art. 45 - Flagrancia'],
  },
  {
    icon: Building2,
    name: 'Código Tributario',
    abbr: 'CT',
    year: 'D.S. 133-2013',
    arts: '198 artículos',
    desc: 'Obligación tributaria, infracciones y sanciones SUNAT. Deuda exigible coactivamente.',
    color: '#10B981',
    articulos: ['Art. 1 - Obligación', 'Art. 28 - Componentes deuda', 'Art. 165 - Infracciones', 'Art. 180 - Sanciones'],
  },
  {
    icon: Landmark,
    name: 'Constitución Política',
    abbr: 'CP 93',
    year: '1993',
    arts: '206 artículos',
    desc: 'Derechos fundamentales, garantías constitucionales. Hábeas corpus, amparo, hábeas data.',
    color: '#22D3EE',
    articulos: ['Art. 2 - Derechos fundamentales', 'Art. 139 - Principios jurisdicción', 'Art. 159 - Ministerio Público', 'Art. 200 - Garantías'],
  },
]

const jurisprudencia = [
  { tribunal: 'TC', exp: 'STC 0050-2004-AI', tema: 'Derechos fundamentales', resumen: 'Estándar de proporcionalidad en restricción de libertades' },
  { tribunal: 'CS', exp: 'R.N. 4539-2019', tema: 'Estafa - Art. 196 CP', resumen: 'Elementos del tipo y acreditación del engaño' },
  { tribunal: 'TC', exp: 'STC 0006-2006-PC', tema: 'Debido proceso', resumen: 'Garantías mínimas del proceso justo' },
  { tribunal: 'CS', exp: 'R.N. 1234-2023', tema: 'Prescripción delitos', resumen: 'Cómputo del plazo ordinario según Art. 80 CP' },
  { tribunal: 'CS', exp: 'R.N. 789-2022', tema: 'Valoración prueba penal', resumen: 'Libre valoración y motivación de sentencias' },
  { tribunal: 'TC', exp: 'STC 1091-2002-HC', tema: 'Prisión preventiva', resumen: 'Proporcionalidad y excepcionalidad de la detención' },
]

export default function LeyesPeruanas() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.05 })

  return (
    <section ref={ref} id="leyes-peruanas" className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #0A0F2E 0%, #0D1545 50%, #0A0F2E 100%)' }} />
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full opacity-10 blur-[120px]"
        style={{ background: 'radial-gradient(ellipse, #7C3AED 0%, transparent 70%)' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.7 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
            style={{ background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.3)', color: '#A78BFA' }}>
            <BookOpen size={14} /> Legislación Peruana
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-5" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Leyes peruanas que <span style={{ color: '#00E5FF' }}>dominamos</span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Lex.ia está entrenada con los principales códigos y leyes del ordenamiento jurídico peruano,
            actualizada con jurisprudencia vinculante del TC y la Corte Suprema.
          </p>
        </motion.div>

        {/* Códigos Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
          {codigos.map((c, i) => {
            const Icon = c.icon
            return (
              <motion.div
                key={c.abbr}
                initial={{ opacity: 0, y: 30 }}
                animate={inView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: i * 0.08, duration: 0.5 }}
                whileHover={{ y: -4, scale: 1.01 }}
                className="relative rounded-2xl p-6 flex flex-col gap-4 group"
                style={{
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
                  border: '1px solid rgba(255,255,255,0.08)',
                }}
              >
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                  style={{ background: `radial-gradient(ellipse at 30% 30%, ${c.color}10 0%, transparent 70%)` }} />

                {/* Header del código */}
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                    style={{ background: `${c.color}15`, border: `1px solid ${c.color}30` }}>
                    <Icon size={20} color={c.color} />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: `${c.color}20`, color: c.color }}>{c.abbr}</span>
                      <span className="text-xs text-slate-500">{c.year}</span>
                    </div>
                    <h3 className="text-sm font-semibold text-white mt-0.5">{c.name}</h3>
                  </div>
                </div>

                {/* Descripción */}
                <p className="text-sm text-slate-400 leading-relaxed">{c.desc}</p>

                {/* Artículos clave */}
                <div className="flex flex-col gap-1.5 mt-auto">
                  {c.articulos.map((art) => (
                    <div key={art} className="flex items-center gap-2 text-xs text-slate-500">
                      <div className="w-1 h-1 rounded-full flex-shrink-0" style={{ background: c.color }} />
                      {art}
                    </div>
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Jurisprudencia Vinculante */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5, duration: 0.6 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-bold text-white" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
              Jurisprudencia vinculante integrada
            </h3>
            <span className="text-xs px-3 py-1 rounded-full font-semibold"
              style={{ background: 'rgba(0,229,255,0.1)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
              Actualización diaria
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {jurisprudencia.map((j, i) => (
              <motion.div
                key={j.exp}
                initial={{ opacity: 0, x: -20 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.6 + i * 0.06, duration: 0.4 }}
                className="flex items-start gap-3 p-4 rounded-xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <span className="text-xs font-bold px-2 py-1 rounded flex-shrink-0 mt-0.5"
                  style={j.tribunal === 'TC'
                    ? { background: 'rgba(124,58,237,0.2)', color: '#A78BFA' }
                    : { background: 'rgba(0,229,255,0.15)', color: '#22D3EE' }}>
                  {j.tribunal}
                </span>
                <div>
                  <p className="text-xs font-semibold text-white">{j.exp}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{j.tema}</p>
                  <p className="text-xs text-slate-500 mt-1">{j.resumen}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* Bottom note */}
          <div className="flex flex-wrap gap-4 mt-6 text-xs text-slate-500">
            <span>📚 +15,000 sentencias indexadas</span>
            <span>⚖️ Tribunal Constitucional (2000–2026)</span>
            <span>🏛️ Corte Suprema (2010–2026)</span>
            <span>🔍 Búsqueda semántica inteligente</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
