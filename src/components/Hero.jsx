import { motion } from 'framer-motion'
import { Sparkles, ArrowRight, Play, ChevronDown } from 'lucide-react'

const BADGES = ['✦ Nuevo', 'IA Legal Peruana', '# 1 en Perú']

export default function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-screen flex flex-col items-center justify-center overflow-hidden"
      style={{ paddingTop: '72px' }}
    >
      {/* Video background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0"
        src={import.meta.env.BASE_URL + 'bg_hero.mp4'}
      />
      {/* Dark overlay para legibilidad */}
      <div className="absolute inset-0 z-0" style={{ background: 'rgba(10,15,46,0.72)' }} />

      {/* Radial glow blobs */}
      <div className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full opacity-10 blur-[120px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #7C3AED, transparent 70%)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-[500px] h-[500px] rounded-full opacity-10 blur-[100px] pointer-events-none"
        style={{ background: 'radial-gradient(circle, #00E5FF, transparent 70%)' }} />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 z-0 opacity-5 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,229,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.3) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      {/* Content */}
      <div className="relative z-10 section-container flex flex-col items-center text-center px-4">

        {/* Badge pill */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="flex items-center gap-2 mb-8"
        >
          <div
            className="flex items-center gap-3 px-5 py-2.5 rounded-full text-xs font-semibold"
            style={{
              background: 'rgba(124,58,237,0.15)',
              border: '1px solid rgba(124,58,237,0.4)',
              color: '#C4B5FD',
            }}
          >
            {BADGES.map((b, i) => (
              <span key={i} className="flex items-center gap-2">
                {i > 0 && <span className="w-1 h-1 rounded-full bg-purple-400 opacity-60" />}
                {b}
              </span>
            ))}
          </div>
        </motion.div>

        {/* H1 */}
        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="font-extrabold leading-[1.08] tracking-tight max-w-4xl"
          style={{
            fontFamily: 'Space Grotesk, sans-serif',
            fontSize: 'clamp(2.6rem, 6vw, 4.2rem)',
          }}
        >
          La{' '}
          <span className="gradient-text">
            Inteligencia Artificial
          </span>
          <br />
          al servicio de la
          <br />
          <span className="text-white">Justicia Peruana</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="mt-6 max-w-2xl text-base md:text-lg leading-relaxed"
          style={{ color: '#94A3B8' }}
        >
          Lex.ia potencia a abogados, fiscales y jueces peruanos con análisis de expedientes,
          predicción de sentencias, redacción asistida y simulación de juicios en tiempo real.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="flex flex-wrap items-center justify-center gap-4 mt-10"
        >
          <a href="#pricing" className="btn-primary">
            <Sparkles size={16} />
            Comenzar gratis
            <ArrowRight size={16} />
          </a>
          <button
            className="btn-ghost"
            onClick={() => document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' })}
          >
            <Play size={14} className="fill-current" />
            Ver en acción
          </button>
        </motion.div>

        {/* Social proof */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="flex items-center gap-3 mt-8 text-sm"
          style={{ color: '#64748B' }}
        >
          <div className="flex -space-x-2">
            {['#7C3AED', '#00E5FF', '#10B981', '#1E3A8A', '#F59E0B'].map((c, i) => (
              <div
                key={i}
                className="w-7 h-7 rounded-full border-2 border-[#0A0F2E] flex items-center justify-center text-xs font-bold text-white"
                style={{ background: c }}
              />
            ))}
          </div>
          <span>+500 profesionales legales confían en Lex.ia</span>
        </motion.div>

        {/* Phone mockup */}
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.88 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: 0.9, duration: 0.9, ease: 'easeOut' }}
          className="relative mt-16 w-full max-w-md mx-auto"
        >
          <div
            className="relative rounded-[2.5rem] overflow-hidden mx-auto"
            style={{
              width: '240px',
              height: '460px',
              background: 'linear-gradient(160deg, #0D1547, #1a1040)',
              border: '2px solid rgba(0,229,255,0.25)',
              boxShadow: '0 0 80px rgba(0,229,255,0.2), 0 0 160px rgba(124,58,237,0.15)',
            }}
          >
            {/* Screen content */}
            <div className="p-5 flex flex-col gap-3 h-full">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #7C3AED, #00E5FF)' }}>
                  <span className="text-xs text-white font-bold">L</span>
                </div>
                <span className="text-white text-xs font-semibold">Lex.ia</span>
              </div>
              {/* Mock chat bubbles */}
              {[
                { text: 'Analiza el Art. 139 de la Constitución', right: false },
                { text: 'El artículo 139 establece los principios de la función jurisdiccional, incluyendo...', right: true },
                { text: '¿Cuál es la probabilidad de éxito?', right: false },
                { text: '87% basado en 312 casos similares', right: true },
              ].map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: msg.right ? 20 : -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1.2 + i * 0.2, duration: 0.4 }}
                  className={`text-xs rounded-xl px-3 py-2 max-w-[85%] leading-relaxed ${msg.right ? 'ml-auto' : 'mr-auto'}`}
                  style={{
                    background: msg.right
                      ? 'linear-gradient(135deg, rgba(124,58,237,0.7), rgba(0,229,255,0.3))'
                      : 'rgba(255,255,255,0.08)',
                    color: msg.right ? '#fff' : '#CBD5E1',
                    border: msg.right ? 'none' : '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  {msg.text}
                </motion.div>
              ))}
            </div>
          </div>

          {/* Glow underneath phone */}
          <div
            className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-48 h-8 blur-2xl rounded-full opacity-50"
            style={{ background: 'linear-gradient(90deg, #7C3AED, #00E5FF)' }}
          />
        </motion.div>

        {/* Scroll cta */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
          className="mt-10 flex flex-col items-center gap-1 cursor-pointer"
          style={{ color: '#475569' }}
          onClick={() => document.getElementById('logos')?.scrollIntoView({ behavior: 'smooth' })}
        >
          <span className="text-xs tracking-widest uppercase">Explorar</span>
          <motion.div animate={{ y: [0, 6, 0] }} transition={{ repeat: Infinity, duration: 1.8 }}>
            <ChevronDown size={18} />
          </motion.div>
        </motion.div>
      </div>
    </section>
  )
}
