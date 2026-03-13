import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Check, Sparkles, ArrowRight, Zap } from 'lucide-react'

const plans = [
  {
    name: 'Básico',
    priceMonthly: 99,
    priceYearly: 79,
    currency: 'S/',
    desc: 'Ideal para abogados independientes que empiezan con IA legal.',
    color: '#7C3AED',
    glow: 'rgba(124,58,237,0.2)',
    badge: null,
    cta: 'Comenzar gratis',
    ctaStyle: 'ghost',
    features: [
      '5 análisis de expedientes / mes',
      'Redacción de escritos básica',
      'Buscador de jurisprudencia',
      'Cálculo de plazos procesales (CPC)',
      'Soporte por chat',
      '1 usuario',
    ],
    notIncluded: [
      'Predictor de resultados',
      'Simulador de juicios',
      'Bóveda de evidencia digital',
    ],
  },
  {
    name: 'Pro',
    priceMonthly: 199,
    priceYearly: 159,
    currency: 'S/',
    desc: 'Para profesionales legales que necesitan el máximo rendimiento.',
    color: '#00E5FF',
    glow: 'rgba(0,229,255,0.25)',
    badge: 'Más Popular',
    cta: 'Empezar con Pro',
    ctaStyle: 'primary',
    features: [
      'Análisis ilimitado de expedientes',
      'Redacción de escritos avanzada con IA',
      'Predictor de resultados judiciales',
      'Simulador de juicios interactivo',
      'Bóveda de evidencia digital',
      'Monitor SINOE automático',
      'Asistente de objeciones en vivo',
      'Todos los roles (abogado, fiscal, juez)',
      'API access',
      'Soporte prioritario 24/7',
    ],
    notIncluded: [],
  },
  {
    name: 'Empresas',
    priceMonthly: null,
    priceYearly: null,
    currency: 'S/',
    desc: 'Para estudios de abogados y despachos con equipos grandes.',
    color: '#10B981',
    glow: 'rgba(16,185,129,0.2)',
    badge: null,
    cta: 'Contactar ventas',
    ctaStyle: 'ghost',
    features: [
      'Todo lo de Pro incluido',
      'Usuarios ilimitados',
      'Dashboard administrativo',
      'Módulos personalizados',
      'Integración con sistemas del estudio',
      'SLA garantizado 99.9%',
      'Onboarding dedicado',
      'Account manager personal',
      'Facturación corporativa',
      'Soporte telefónico prioritario',
    ],
    notIncluded: [],
  },
]

function PlanCard({ plan, isYearly, index, inView }) {
  const isPro = plan.name === 'Pro'
  const price = isYearly ? plan.priceYearly : plan.priceMonthly
  const isEnterprise = plan.priceMonthly === null

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay: index * 0.12, duration: 0.6 }}
      className="relative flex flex-col rounded-3xl overflow-hidden"
      style={{
        background: isPro
          ? 'linear-gradient(155deg, rgba(0,229,255,0.08) 0%, rgba(124,58,237,0.12) 100%)'
          : 'rgba(255,255,255,0.03)',
        border: `1.5px solid ${isPro ? plan.color + '50' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: isPro
          ? `0 0 60px ${plan.glow}, 0 0 120px rgba(0,229,255,0.1)`
          : 'none',
        transform: isPro ? 'scale(1.04)' : 'scale(1)',
        zIndex: isPro ? 2 : 1,
      }}
    >
      {/* Popular badge */}
      {plan.badge && (
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-px flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-b-xl"
          style={{
            background: 'linear-gradient(90deg, #00E5FF, #7C3AED)',
            color: '#0A0F2E',
          }}
        >
          <Zap size={11} />
          {plan.badge}
        </div>
      )}

      <div className="p-7 flex flex-col gap-5 flex-1" style={{ paddingTop: plan.badge ? '2.5rem' : '1.75rem' }}>
        {/* Plan name */}
        <div>
          <div
            className="text-xs font-semibold uppercase tracking-wider mb-2"
            style={{ color: plan.color }}
          >
            {plan.name}
          </div>
          <p className="text-sm" style={{ color: '#64748B' }}>
            {plan.desc}
          </p>
        </div>

        {/* Price */}
        <div className="flex items-end gap-1">
          {isEnterprise ? (
            <div>
              <span
                className="text-3xl font-extrabold"
                style={{ fontFamily: 'Space Grotesk, sans-serif', color: plan.color }}
              >
                A medida
              </span>
            </div>
          ) : (
            <>
              <span className="text-xl font-semibold mb-1" style={{ color: '#94A3B8' }}>
                {plan.currency}
              </span>
              <span
                className="text-5xl font-extrabold leading-none"
                style={{
                  fontFamily: 'Space Grotesk, sans-serif',
                  color: isPro ? '#00E5FF' : '#F0F4FF',
                }}
              >
                {price}
              </span>
              <span className="text-sm mb-1 ml-1" style={{ color: '#64748B' }}>
                /mes
              </span>
            </>
          )}
        </div>

        {isYearly && !isEnterprise && (
          <div
            className="text-xs font-medium px-2 py-1 rounded-full w-fit"
            style={{
              background: 'rgba(16,185,129,0.15)',
              color: '#10B981',
              border: '1px solid rgba(16,185,129,0.3)',
            }}
          >
            Ahorras 20% con pago anual
          </div>
        )}

        {/* CTA button */}
        <a
          href={isEnterprise ? 'mailto:ventas@lexia.pe' : '#'}
          className={plan.ctaStyle === 'primary' ? 'btn-primary' : 'btn-ghost'}
          style={plan.ctaStyle === 'ghost' ? { borderColor: `${plan.color}50`, color: plan.color } : {}}
        >
          {plan.ctaStyle === 'primary' && <Sparkles size={14} />}
          {plan.cta}
          <ArrowRight size={14} />
        </a>

        {/* Divider */}
        <div style={{ height: '1px', background: 'rgba(255,255,255,0.07)' }} />

        {/* Features */}
        <ul className="flex flex-col gap-2.5">
          {plan.features.map((f, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <div
                className="w-4.5 h-4.5 rounded-full flex items-center justify-center mt-0.5 flex-shrink-0"
                style={{
                  background: `${plan.color}20`,
                  minWidth: '18px',
                  minHeight: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Check size={11} color={plan.color} />
              </div>
              <span className="text-sm" style={{ color: '#CBD5E1' }}>{f}</span>
            </li>
          ))}
          {plan.notIncluded.map((f, i) => (
            <li key={`no-${i}`} className="flex items-start gap-2.5 opacity-35">
              <div
                style={{
                  minWidth: '18px',
                  minHeight: '18px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}
              >
                <span style={{ color: '#475569', fontSize: '10px' }}>—</span>
              </div>
              <span className="text-sm line-through" style={{ color: '#475569' }}>{f}</span>
            </li>
          ))}
        </ul>
      </div>
    </motion.div>
  )
}

export default function Pricing() {
  const [isYearly, setIsYearly] = useState(false)
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.1 })

  return (
    <section id="pricing" className="py-28 relative overflow-hidden">
      {/* Purple gradient blob */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] rounded-full opacity-[0.07] blur-[100px] pointer-events-none"
        style={{ background: 'radial-gradient(ellipse, #7C3AED, transparent 70%)' }}
      />

      <div className="section-container relative z-10" ref={ref}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-14"
        >
          <span
            className="text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full"
            style={{
              background: 'rgba(0,229,255,0.08)',
              border: '1px solid rgba(0,229,255,0.2)',
              color: '#00E5FF',
            }}
          >
            Planes y Precios
          </span>
          <h2
            className="mt-5 font-extrabold text-white"
            style={{
              fontFamily: 'Space Grotesk, sans-serif',
              fontSize: 'clamp(1.8rem, 4vw, 2.8rem)',
            }}
          >
            Invierte en tu{' '}
            <span className="gradient-text">ventaja competitiva</span>
          </h2>

          {/* Free trial banner */}
          <div
            className="inline-flex items-center gap-2 mt-5 px-5 py-2.5 rounded-full text-sm font-semibold"
            style={{
              background: 'linear-gradient(90deg, rgba(0,229,255,0.12), rgba(124,58,237,0.12))',
              border: '1px solid rgba(0,229,255,0.3)',
              color: '#00E5FF',
            }}
          >
            <Sparkles size={14} />
            14 días de prueba gratis en todos los planes · Sin tarjeta de crédito
          </div>

          <p className="mt-3 text-base" style={{ color: '#94A3B8' }}>
            Sin contratos de largo plazo. Cancela cuando quieras.
          </p>

          {/* Toggle Mensual / Anual */}
          <div className="flex items-center justify-center gap-4 mt-8">
            <span
              className="text-sm font-medium"
              style={{ color: !isYearly ? '#F0F4FF' : '#64748B' }}
            >
              Mensual
            </span>
            <button
              onClick={() => setIsYearly(!isYearly)}
              className="relative w-14 h-7 rounded-full transition-all duration-300 flex-shrink-0"
              style={{
                background: isYearly
                  ? 'linear-gradient(135deg, #7C3AED, #00E5FF)'
                  : 'rgba(255,255,255,0.1)',
              }}
            >
              <motion.div
                className="absolute top-1 w-5 h-5 rounded-full bg-white shadow-md"
                animate={{ left: isYearly ? '1.75rem' : '0.25rem' }}
                transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              />
            </button>
            <span
              className="text-sm font-medium flex items-center gap-2"
              style={{ color: isYearly ? '#F0F4FF' : '#64748B' }}
            >
              Anual
              <AnimatePresence>
                {isYearly && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    className="text-xs font-bold px-2 py-0.5 rounded-full"
                    style={{
                      background: 'rgba(16,185,129,0.2)',
                      color: '#10B981',
                      border: '1px solid rgba(16,185,129,0.3)',
                    }}
                  >
                    -20%
                  </motion.span>
                )}
              </AnimatePresence>
            </span>
          </div>
        </motion.div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          {plans.map((plan, i) => (
            <PlanCard key={i} plan={plan} isYearly={isYearly} index={i} inView={inView} />
          ))}
        </div>

        {/* Footer note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={inView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="text-center text-sm mt-10"
          style={{ color: '#475569' }}
        >
          Todos los planes incluyen 14 días de prueba gratuita. No se requiere tarjeta de crédito.
        </motion.p>
      </div>
    </section>
  )
}
