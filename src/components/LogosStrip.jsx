import { motion } from 'framer-motion'

// Dimensiones reales del sprite — ajustar si difieren
const SPRITE_W = 1320
const SPRITE_H = 650
// Altura de display uniforme para todos los logos
const TARGET_H = 56

const rawInstitutions = [
  { name: 'SUNARP',                  bgX: 0,    bgY: 0,    srcW: 401, srcH: 223 },
  { name: 'SUNAT',                   bgX: -441, bgY: -48,  srcW: 484, srcH: 141 },
  { name: 'Poder Judicial del Perú', bgX: -969, bgY: -20,  srcW: 351, srcH: 239 },
  { name: 'Ministerio Público',      bgX: -4,   bgY: -366, srcW: 794, srcH: 284 },
  { name: 'INDECOPI',                bgX: -855, bgY: -320, srcW: 454, srcH: 131 },
  { name: 'OSIPTEL',                 bgX: -893, bgY: -471, srcW: 426, srcH: 102 },
]

// Calcula estilos escalados proporcio nalmente
const INSTITUTIONS = rawInstitutions.map(inst => {
  const scale = TARGET_H / inst.srcH
  return {
    name: inst.name,
    style: {
      width: `${Math.round(inst.srcW * scale)}px`,
      height: `${TARGET_H}px`,
      backgroundImage: "url('/institutions_sprite.png')",
      backgroundRepeat: 'no-repeat',
      backgroundPosition: `${Math.round(inst.bgX * scale)}px ${Math.round(inst.bgY * scale)}px`,
      backgroundSize: `${Math.round(SPRITE_W * scale)}px ${Math.round(SPRITE_H * scale)}px`,
      flexShrink: 0,
    },
  }
})

// Duplicado ×2 para el loop infinito del marquee
const DOUBLE = [...INSTITUTIONS, ...INSTITUTIONS]

export default function LogosStrip() {
  return (
    <section
      id="logos"
      className="py-16 overflow-hidden"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="section-container mb-10">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-xs font-semibold tracking-[0.2em] uppercase"
          style={{ color: '#334155' }}
        >
          Ayuda legales en
        </motion.p>
      </div>

      <div className="relative">
        {/* Fade edges */}
        <div
          className="absolute left-0 top-0 bottom-0 w-32 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(90deg, #0A0F2E 40%, transparent)' }}
        />
        <div
          className="absolute right-0 top-0 bottom-0 w-32 z-10 pointer-events-none"
          style={{ background: 'linear-gradient(-90deg, #0A0F2E 40%, transparent)' }}
        />

        <div className="flex overflow-hidden">
          <motion.div
            className="flex items-center gap-14 flex-shrink-0"
            animate={{ x: ['0%', '-50%'] }}
            transition={{ duration: 36, ease: 'linear', repeat: Infinity }}
          >
            {DOUBLE.map((inst, i) => (
              <div
                key={i}
                title={inst.name}
                className="opacity-60 hover:opacity-100 transition-opacity duration-300"
                style={inst.style}
              />
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
