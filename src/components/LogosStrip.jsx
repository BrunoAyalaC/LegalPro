import { motion } from 'framer-motion'

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
          Diseñado para operar en el marco legal peruano
        </motion.p>
      </div>
    </section>
  )
}
