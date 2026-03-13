import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import CountUp from 'react-countup'
import { Users, Target, Wrench, HeartHandshake } from 'lucide-react'

const stats = [
  {
    icon: Users,
    value: 500,
    suffix: '+',
    label: 'Abogados Activos',
    desc: 'Profesionales legales que confían en Lex.ia cada día',
    color: '#7C3AED',
  },
  {
    icon: Target,
    value: 95,
    suffix: '%',
    label: 'Precisión IA',
    desc: 'En predicción de resultados judiciales con datos reales',
    color: '#00E5FF',
  },
  {
    icon: Wrench,
    value: 13,
    suffix: '',
    label: 'Herramientas',
    desc: 'Especializadas por rol: abogado, fiscal, juez y contador',
    color: '#10B981',
  },
  {
    icon: HeartHandshake,
    value: 24,
    suffix: '/7',
    label: 'Soporte IA',
    desc: 'Asistente legal disponible en cualquier momento del día',
    color: '#F59E0B',
  },
]

function StatCard({ stat, index, inView }) {
  const Icon = stat.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.1, duration: 0.6 }}
      whileHover={{ scale: 1.04 }}
      className="relative flex flex-col items-center text-center p-8 rounded-2xl group"
      style={{
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.07)',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      {/* Icon */}
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
        style={{
          background: `${stat.color}15`,
          border: `1px solid ${stat.color}30`,
          boxShadow: `0 0 30px ${stat.color}20`,
        }}
      >
        <Icon size={24} color={stat.color} />
      </div>

      {/* Number */}
      <div
        className="text-5xl md:text-6xl font-extrabold leading-none mb-2"
        style={{
          fontFamily: 'Space Grotesk, sans-serif',
          color: stat.color,
          textShadow: `0 0 30px ${stat.color}60`,
        }}
      >
        {inView ? (
          <CountUp
            end={stat.value}
            duration={2.2}
            delay={index * 0.15}
            suffix={stat.suffix}
          />
        ) : (
          `0${stat.suffix}`
        )}
      </div>

      {/* Label */}
      <div
        className="text-base font-bold text-white mb-2"
        style={{ fontFamily: 'Space Grotesk, sans-serif' }}
      >
        {stat.label}
      </div>

      {/* Desc */}
      <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>
        {stat.desc}
      </p>

      {/* Hover glow */}
      <div
        className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-400 pointer-events-none"
        style={{ border: `1px solid ${stat.color}40` }}
      />
    </motion.div>
  )
}

export default function Stats() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 })

  return (
    <section id="stats" className="py-24 relative overflow-hidden">
      {/* BG stripe */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, rgba(0,229,255,0.03) 50%, transparent 100%)',
        }}
      />

      <div className="section-container relative z-10" ref={ref}>
        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span
            className="text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full"
            style={{
              background: 'rgba(16,185,129,0.08)',
              border: '1px solid rgba(16,185,129,0.25)',
              color: '#10B981',
            }}
          >
            Resultados Comprobados
          </span>
          <h2
            className="mt-5 font-extrabold text-white"
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
            }}
          >
            Números que hablan
            <br />
            <span className="gradient-text-green">por sí solos</span>
          </h2>
        </motion.div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {stats.map((s, i) => (
            <StatCard key={i} stat={s} index={i} inView={inView} />
          ))}
        </div>
      </div>
    </section>
  )
}
