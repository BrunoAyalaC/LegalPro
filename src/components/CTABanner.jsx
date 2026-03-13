import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Sparkles, ArrowRight, Shield, Zap, Clock } from 'lucide-react'

const pillars = [
  { icon: Zap, label: '14 días gratis', color: '#F59E0B' },
  { icon: Shield, label: 'Sin contratos', color: '#10B981' },
  { icon: Clock, label: 'Activación inmediata', color: '#00E5FF' },
]

export default function CTABanner() {
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.2 })

  return (
    <section
      className="py-28 relative overflow-hidden"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      {/* God-ray radial background */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 60% at 50% 50%, rgba(0,229,255,0.1) 0%, rgba(124,58,237,0.08) 40%, transparent 70%)',
        }}
      />

      {/* Animated ring */}
      <motion.div
        animate={{ scale: [1, 1.05, 1], opacity: [0.2, 0.35, 0.2] }}
        transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full pointer-events-none"
        style={{
          border: '1px solid rgba(0,229,255,0.15)',
          boxShadow: '0 0 80px rgba(0,229,255,0.08) inset',
        }}
      />
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.1, 0.2, 0.1] }}
        transition={{ repeat: Infinity, duration: 5, ease: 'easeInOut', delay: 0.5 }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[900px] h-[900px] rounded-full pointer-events-none"
        style={{ border: '1px solid rgba(124,58,237,0.1)' }}
      />

      <div className="section-container relative z-10 text-center" ref={ref}>
        {/* Eyebrow */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
        >
          <span
            className="text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full"
            style={{
              background: 'rgba(0,229,255,0.08)',
              border: '1px solid rgba(0,229,255,0.2)',
              color: '#00E5FF',
            }}
          >
            Empieza hoy mismo
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mt-6 font-extrabold text-white max-w-3xl mx-auto leading-tight"
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          }}
        >
          Ejerce el derecho con la{' '}
          <span
            className="gradient-text"
            style={{ display: 'inline-block' }}
          >
            IA más avanzada
          </span>{' '}
          del Perú
        </motion.h2>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mt-5 text-base md:text-lg max-w-xl mx-auto"
          style={{ color: '#94A3B8' }}
        >
          Únete a +500 profesionales legales que ya trabajan más inteligente, más rápido
          y con mayor precisión gracias a Lex.ia.
        </motion.p>

        {/* Pillars */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-wrap items-center justify-center gap-4 mt-8"
        >
          {pillars.map((p, i) => {
            const Icon = p.icon
            return (
              <div
                key={i}
                className="flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium"
                style={{
                  background: `${p.color}12`,
                  border: `1px solid ${p.color}30`,
                  color: p.color,
                }}
              >
                <Icon size={14} />
                {p.label}
              </div>
            )
          })}
        </motion.div>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="flex flex-wrap items-center justify-center gap-4 mt-10"
        >
          <a href="#pricing" className="btn-primary" style={{ padding: '16px 40px', fontSize: '1rem' }}>
            <Sparkles size={18} />
            Comenzar gratis — 14 días
            <ArrowRight size={16} />
          </a>
          <a
            href="mailto:ventas@lexia.pe"
            className="btn-ghost"
            style={{ padding: '16px 36px', fontSize: '1rem' }}
          >
            Hablar con ventas
          </a>
        </motion.div>

        {/* Trust note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ duration: 0.6, delay: 0.6 }}
          className="mt-6 text-xs"
          style={{ color: '#475569' }}
        >
          Sin tarjeta de crédito · Cancela en cualquier momento · Datos protegidos con AES-256
        </motion.p>
      </div>
    </section>
  )
}
