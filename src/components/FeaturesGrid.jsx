import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import {
  Brain, TrendingUp, FileEdit, Scale, Mic, Clock, Search, Shield
} from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'Análisis de Expedientes IA',
    desc: 'Sube documentos y obtén análisis jurídico profundo, identificación de riesgos y estrategia recomendada en segundos.',
    color: '#7C3AED',
    glow: 'rgba(124,58,237,0.25)',
    tag: 'Abogados & Fiscales',
  },
  {
    icon: TrendingUp,
    title: 'Predictor Judicial',
    desc: 'Predice el resultado de tu caso con 95%+ precisión basándose en miles de precedentes del Poder Judicial peruano.',
    color: '#00E5FF',
    glow: 'rgba(0,229,255,0.25)',
    tag: 'Machine Learning',
  },
  {
    icon: FileEdit,
    title: 'Redactor de Escritos',
    desc: 'Genera demandas, apelaciones, recursos y requerimientos fiscales con estructura legal perfecta y argumentación sólida.',
    color: '#10B981',
    glow: 'rgba(16,185,129,0.25)',
    tag: 'IA Avanzada',
  },
  {
    icon: Scale,
    title: 'Simulador de Juicios',
    desc: 'Practica audiencias completas: IA actúa como juez, fiscal o defensa. Feedback inmediato sobre argumentación.',
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.25)',
    tag: 'Simulación Interactiva',
  },
  {
    icon: Mic,
    title: 'Asistente de Objeciones',
    desc: 'En plena audiencia, recibe sugerencias de objeciones en tiempo real basadas en el NCPP peruano.',
    color: '#EF4444',
    glow: 'rgba(239,68,68,0.25)',
    tag: 'Tiempo Real',
  },
  {
    icon: Clock,
    title: 'Cálculo de Plazos',
    desc: 'Calcula automáticamente plazos procesales, fechas de vencimiento y alertas para nunca perder un término judicial.',
    color: '#8B5CF6',
    glow: 'rgba(139,92,246,0.25)',
    tag: 'CPC & NCPP',
  },
  {
    icon: Search,
    title: 'Buscador de Jurisprudencia',
    desc: 'Accede a jurisprudencia vinculante del TC, Corte Suprema e INDECOPI con búsqueda semántica inteligente.',
    color: '#22D3EE',
    glow: 'rgba(34,211,238,0.25)',
    tag: 'Bases de Datos Legales',
  },
  {
    icon: Shield,
    title: 'Bóveda de Evidencia',
    desc: 'Almacena y organiza evidencia digital con hash de integridad, cadena de custodia y permisos por rol.',
    color: '#EC4899',
    glow: 'rgba(236,72,153,0.25)',
    tag: 'Seguridad Máxima',
  },
]

const cardVariants = {
  hidden: { opacity: 0, y: 40 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: 'easeOut' },
  }),
}

function FeatureCard({ feature, index }) {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })
  const Icon = feature.icon
  return (
    <motion.div
      ref={ref}
      custom={index}
      variants={cardVariants}
      initial="hidden"
      animate={inView ? 'visible' : 'hidden'}
      whileHover={{ y: -6, scale: 1.02 }}
      transition={{ type: 'spring', stiffness: 300 }}
      className="group relative rounded-2xl p-6 flex flex-col gap-4 cursor-default"
      style={{
        background:
          'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.01) 100%)',
        border: '1px solid rgba(255,255,255,0.08)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)',
      }}
    >
      {/* Hover glow border */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
        style={{
          background: `linear-gradient(135deg, ${feature.glow}, transparent)`,
          border: `1px solid ${feature.color}44`,
        }}
      />

      {/* Icon */}
      <div
        className="relative w-12 h-12 rounded-xl flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, ${feature.color}22, ${feature.color}08)`,
          border: `1px solid ${feature.color}33`,
          boxShadow: `0 0 24px ${feature.glow}`,
        }}
      >
        <Icon size={22} color={feature.color} />
      </div>

      {/* Tag */}
      <span
        className="text-xs font-semibold px-2.5 py-1 rounded-full w-fit"
        style={{
          background: `${feature.color}18`,
          color: feature.color,
          border: `1px solid ${feature.color}33`,
        }}
      >
        {feature.tag}
      </span>

      {/* Text */}
      <div className="flex flex-col gap-2 relative z-10">
        <h3
          className="text-base font-bold text-white leading-tight"
          style={{ fontFamily: 'Space Grotesk, sans-serif' }}
        >
          {feature.title}
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: '#94A3B8' }}>
          {feature.desc}
        </p>
      </div>
    </motion.div>
  )
}

export default function FeaturesGrid() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })

  return (
    <section id="features" className="py-28 relative overflow-hidden">
      {/* Hex texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='28' height='49' viewBox='0 0 28 49'%3E%3Cpath d='M13.99 9.25l13 7.5v15l-13 7.5L1 31.75v-15l12.99-7.5zM3 17.9v12.7l10.99 6.34 11-6.35V17.9l-11-6.34L3 17.9zM0 15l12.98-7.5V0h-2v6.35L0 12.69v2.3zm0 18.5L12.98 41v8h-2v-6.85L0 35.81v-2.3zM15 0v7.5L27.99 15H28v-2.31h-.01L17 6.35V0h-2zm0 49v-8l12.99-7.5H28v2.31h-.01L17 42.15V49h-2z' fill='%2300E5FF'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="section-container relative z-10">
        {/* Heading */}
        <motion.div
          ref={ref}
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span
            className="text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full"
            style={{
              background: 'rgba(0,229,255,0.08)',
              border: '1px solid rgba(0,229,255,0.2)',
              color: '#00E5FF',
            }}
          >
            Herramientas Especializadas
          </span>
          <h2
            className="mt-5 font-extrabold text-white leading-tight"
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: 'clamp(2rem, 4vw, 3rem)',
            }}
          >
            Todo lo que necesitas para
            <br />
            <span className="gradient-text">ejercer el derecho con IA</span>
          </h2>
          <p className="mt-4 text-base max-w-2xl mx-auto" style={{ color: '#94A3B8' }}>
            13 herramientas diseñadas para abogados, fiscales, jueces y contadores peruanos.
            Contextualizadas con el CPC, NCPP, SINOE y la jurisprudencia nacional.
          </p>
        </motion.div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {features.map((f, i) => (
            <FeatureCard key={i} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}
