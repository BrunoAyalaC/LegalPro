import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Check, Brain, Gavel, FileText, Users } from 'lucide-react'

const roles = [
  {
    icon: Gavel,
    label: 'Abogado Defensor',
    color: '#7C3AED',
    title: 'Litigación de alto nivel potenciada por IA',
    subtitle: 'Para abogados litigantes',
    benefits: [
      'Análisis automático de expedientes con riesgo y estrategia',
      'Redacción de demandas y apelaciones en minutos',
      'Predictor de resultados con base en precedentes reales',
      'Simulador de juicios para preparar audiencias',
      'Búsqueda de jurisprudencia con semántica avanzada',
      'Bóveda de evidencia digital con cadena de custodia',
    ],
    visual: {
      label: 'Análisis IA en tiempo real',
      metrics: [
        { name: 'Probabilidad de éxito', value: '87%', color: '#10B981' },
        { name: 'Precedentes similares', value: '312', color: '#00E5FF' },
        { name: 'Riesgo procesal', value: 'Bajo', color: '#F59E0B' },
      ],
    },
  },
  {
    icon: Users,
    label: 'Fiscal',
    color: '#00E5FF',
    title: 'Acusaciones sólidas con respaldo analítico',
    subtitle: 'Para fiscales del Ministerio Público',
    benefits: [
      'Generador de requerimientos y acusaciones fiscales',
      'Análisis de casos penales bajo el NCPP',
      'Estrategia de interrogatorio inteligente',
      'Predictor de sentencias penales',
      'Monitor de notificaciones SINOE automático',
      'Simulador de juzgamiento completo',
    ],
    visual: {
      label: 'Requerimiento Fiscal Generado',
      metrics: [
        { name: 'Calidad del escrito', value: '94/100', color: '#00E5FF' },
        { name: 'Artículos citados', value: '18', color: '#7C3AED' },
        { name: 'Tiempo ahorrado', value: '6h', color: '#10B981' },
      ],
    },
  },
  {
    icon: Brain,
    label: 'Juez',
    color: '#10B981',
    title: 'Resoluciones fundamentadas con precisión',
    subtitle: 'Para magistrados del Poder Judicial',
    benefits: [
      'Comparador de precedentes vinculantes del TC',
      'Asistente de redacción de resoluciones judiciales',
      'Análisis de expedientes para decisión judicial',
      'Predictor de tendencias jurisprudenciales',
      'Cálculo automático de plazos y prescripciones',
      'Herramientas de conciliación y mediación',
    ],
    visual: {
      label: 'Precedentes Vinculantes',
      metrics: [
        { name: 'Precedentes encontrados', value: '48', color: '#10B981' },
        { name: 'Relevancia promedio', value: '91%', color: '#00E5FF' },
        { name: 'Tiempo de análisis', value: '2min', color: '#F59E0B' },
      ],
    },
  },
  {
    icon: FileText,
    label: 'Contador Perito',
    color: '#F59E0B',
    title: 'Pericias contables con validez judicial',
    subtitle: 'Para contadores y peritos',
    benefits: [
      'Cálculo de liquidaciones laborales y CTS',
      'Generación automática de informes periciales',
      'Análisis de estados financieros para casos',
      'Cálculo de intereses legales según tasas SBS',
      'Herramientas multidisciplinarias especializadas',
      'Exportación a formatos aceptados por el PJ',
    ],
    visual: {
      label: 'Informe Pericial Contable',
      metrics: [
        { name: 'CTS calculada', value: 'S/ 24,850', color: '#F59E0B' },
        { name: 'Horas extras', value: '328h', color: '#EF4444' },
        { name: 'Intereses legales', value: 'S/ 3,200', color: '#10B981' },
      ],
    },
  },
]

function RoleCard({ role, isActive, onClick }) {
  const Icon = role.icon
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 px-5 py-3.5 rounded-xl text-left transition-all duration-300 w-full"
      style={{
        background: isActive ? `${role.color}18` : 'transparent',
        border: `1.5px solid ${isActive ? role.color + '60' : 'rgba(255,255,255,0.08)'}`,
        color: isActive ? '#fff' : '#64748B',
      }}
    >
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: isActive ? `${role.color}30` : 'rgba(255,255,255,0.05)' }}
      >
        <Icon size={18} color={isActive ? role.color : '#64748B'} />
      </div>
      <span className="text-sm font-semibold">{role.label}</span>
      {isActive && (
        <motion.div
          layoutId="activeIndicator"
          className="ml-auto w-2 h-2 rounded-full"
          style={{ background: role.color }}
        />
      )}
    </button>
  )
}

import { useState } from 'react'

export default function FeatureShowcase() {
  const [activeRole, setActiveRole] = useState(0)
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })
  const role = roles[activeRole]

  return (
    <section id="showcase" className="py-28 relative overflow-hidden">
      {/* Background gradient */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(124,58,237,0.04) 50%, transparent 100%)',
        }}
      />

      <div className="section-container relative z-10" ref={ref}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span
            className="text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full"
            style={{
              background: 'rgba(124,58,237,0.08)',
              border: '1px solid rgba(124,58,237,0.25)',
              color: '#C4B5FD',
            }}
          >
            Hecho para cada rol legal
          </span>
          <h2
            className="mt-5 font-extrabold text-white"
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
            }}
          >
            Una plataforma, <span className="gradient-text">cuatro roles</span>
          </h2>
          <p className="mt-3 text-base" style={{ color: '#94A3B8' }}>
            Lex.ia adapta sus herramientas según tu función en el sistema judicial peruano.
          </p>
        </motion.div>

        {/* Two columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          {/* Left: role selector + benefits */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="flex flex-col gap-6"
          >
            {/* Role tabs */}
            <div className="grid grid-cols-2 gap-2">
              {roles.map((r, i) => (
                <RoleCard
                  key={i}
                  role={r}
                  isActive={activeRole === i}
                  onClick={() => setActiveRole(i)}
                />
              ))}
            </div>

            {/* Benefits */}
            <motion.div
              key={activeRole}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35 }}
              className="rounded-2xl p-6"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
              }}
            >
              <span
                className="text-xs font-semibold uppercase tracking-wider"
                style={{ color: role.color }}
              >
                {role.subtitle}
              </span>
              <h3
                className="mt-2 text-xl font-bold text-white leading-snug"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                {role.title}
              </h3>
              <ul className="mt-5 flex flex-col gap-3">
                {role.benefits.map((b, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0"
                      style={{ background: `${role.color}20`, border: `1px solid ${role.color}50` }}
                    >
                      <Check size={11} color={role.color} />
                    </div>
                    <span className="text-sm" style={{ color: '#CBD5E1' }}>{b}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          </motion.div>

          {/* Right: visual card */}
          <motion.div
            key={`visual-${activeRole}`}
            initial={{ opacity: 0, x: 30, scale: 0.96 }}
            animate={inView ? { opacity: 1, x: 0, scale: 1 } : {}}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative rounded-3xl p-6 md:p-8"
            style={{
              background:
                'linear-gradient(135deg, rgba(255,255,255,0.05), rgba(255,255,255,0.01))',
              border: `1px solid ${role.color}30`,
              boxShadow: `0 0 60px ${role.color}15`,
              minHeight: '420px',
            }}
          >
            {/* Top bar */}
            <div className="flex items-center gap-2 mb-6">
              <div className="flex gap-1.5">
                <span className="w-3 h-3 rounded-full bg-red-500/60" />
                <span className="w-3 h-3 rounded-full bg-yellow-500/60" />
                <span className="w-3 h-3 rounded-full bg-green-500/60" />
              </div>
              <span
                className="text-xs font-medium ml-2 px-3 py-1 rounded-full"
                style={{
                  background: `${role.color}15`,
                  color: role.color,
                  border: `1px solid ${role.color}30`,
                }}
              >
                {role.visual.label}
              </span>
            </div>

            {/* Metrics */}
            <div className="flex flex-col gap-4">
              {role.visual.metrics.map((m, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.12, duration: 0.4 }}
                  className="flex items-center justify-between p-4 rounded-xl"
                  style={{
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <span className="text-sm" style={{ color: '#94A3B8' }}>{m.name}</span>
                  <span
                    className="text-lg font-bold"
                    style={{ color: m.color, fontFamily: 'Space Grotesk, sans-serif' }}
                  >
                    {m.value}
                  </span>
                </motion.div>
              ))}
            </div>

            {/* Simulated AI analysis bar */}
            <div className="mt-8">
              <div
                className="text-xs mb-3 font-semibold uppercase tracking-wider"
                style={{ color: '#475569' }}
              >
                Análisis en procesamiento
              </div>
              <div className="flex flex-col gap-2">
                {['Normativa aplicable', 'Precedentes vinculantes', 'Estrategia procesal'].map(
                  (item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div
                        className="text-xs w-40"
                        style={{ color: '#64748B' }}
                      >
                        {item}
                      </div>
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.08)' }}>
                        <motion.div
                          className="h-full rounded-full"
                          style={{ background: `linear-gradient(90deg, ${role.color}, #00E5FF)` }}
                          initial={{ width: '0%' }}
                          animate={{ width: `${75 + i * 8}%` }}
                          transition={{ delay: 0.3 + i * 0.15, duration: 0.8 }}
                        />
                      </div>
                      <span className="text-xs font-mono" style={{ color: role.color }}>
                        {75 + i * 8}%
                      </span>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Glow corners */}
            <div
              className="absolute top-0 right-0 w-32 h-32 rounded-3xl opacity-20 pointer-events-none"
              style={{ background: `radial-gradient(circle at top right, ${role.color}, transparent 70%)` }}
            />
            <div
              className="absolute bottom-0 left-0 w-24 h-24 rounded-3xl opacity-15 pointer-events-none"
              style={{ background: `radial-gradient(circle at bottom left, #00E5FF, transparent 70%)` }}
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
