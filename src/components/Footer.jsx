import { motion } from 'framer-motion'
import { Scale, Twitter, Linkedin, Instagram, Youtube, Mail, Phone } from 'lucide-react'

const footerLinks = [
  {
    title: 'Producto',
    links: [
      { label: 'Características', href: '#features' },
      { label: 'Roles y Herramientas', href: '#showcase' },
      { label: 'Estadísticas', href: '#stats' },
      { label: 'Precios', href: '#pricing' },
      { label: 'App Android', href: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Términos de servicio', href: '#' },
      { label: 'Política de privacidad', href: '#' },
      { label: 'Política de cookies', href: '#' },
      { label: 'Protección de datos', href: '#' },
      { label: 'DPDP / LFPDPPP', href: '#' },
    ],
  },
  {
    title: 'Empresa',
    links: [
      { label: 'Acerca de nosotros', href: '#' },
      { label: 'Blog Legal IA', href: '#' },
      { label: 'Casos de éxito', href: '#' },
      { label: 'Partnerships', href: '#' },
      { label: 'Contacto', href: 'mailto:hola@lexia.pe' },
    ],
  },
]

const socials = [
  { icon: Twitter, href: '#', label: 'Twitter' },
  { icon: Linkedin, href: '#', label: 'LinkedIn' },
  { icon: Instagram, href: '#', label: 'Instagram' },
  { icon: Youtube, href: '#', label: 'YouTube' },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer
      className="relative overflow-hidden"
      style={{ borderTop: '1px solid rgba(255,255,255,0.07)' }}
    >
      {/* Gradient fade top */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg, transparent, rgba(0,229,255,0.3), transparent)' }}
      />

      <div className="section-container py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8">
          {/* Brand column */}
          <div className="lg:col-span-2">
            <a href="#" className="flex items-center gap-2.5 no-underline mb-5">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #7C3AED, #00E5FF)' }}
              >
                <Scale size={20} color="white" />
              </div>
              <span
                className="text-xl font-bold text-white"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                Lex<span className="gradient-text">.ia</span>
              </span>
            </a>
            <p className="text-sm leading-relaxed mb-6 max-w-xs" style={{ color: '#64748B' }}>
              La plataforma de inteligencia artificial legal más avanzada del Perú. Diseñada para
              abogados, fiscales, jueces y contadores peruanos.
            </p>

            {/* Contact */}
            <div className="flex flex-col gap-2 mb-6">
              <a
                href="mailto:hola@lexia.pe"
                className="flex items-center gap-2 text-sm transition-colors hover:text-white"
                style={{ color: '#475569', textDecoration: 'none' }}
              >
                <Mail size={14} />
                hola@lexia.pe
              </a>
              <a
                href="tel:+51999999999"
                className="flex items-center gap-2 text-sm transition-colors hover:text-white"
                style={{ color: '#475569', textDecoration: 'none' }}
              >
                <Phone size={14} />
                +51 999 999 999
              </a>
            </div>

            {/* Social icons */}
            <div className="flex items-center gap-3">
              {socials.map((s, i) => {
                const Icon = s.icon
                return (
                  <motion.a
                    key={i}
                    href={s.href}
                    aria-label={s.label}
                    whileHover={{ scale: 1.1, y: -2 }}
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                    style={{
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#64748B',
                      textDecoration: 'none',
                    }}
                  >
                    <Icon size={15} />
                  </motion.a>
                )
              })}
            </div>
          </div>

          {/* Link columns */}
          {footerLinks.map((col, i) => (
            <div key={i}>
              <h4
                className="text-sm font-bold text-white mb-4"
                style={{ fontFamily: 'Space Grotesk, sans-serif' }}
              >
                {col.title}
              </h4>
              <ul className="flex flex-col gap-3">
                {col.links.map((link, j) => (
                  <li key={j}>
                    <a
                      href={link.href}
                      className="text-sm transition-colors hover:text-white"
                      style={{ color: '#64748B', textDecoration: 'none' }}
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="flex flex-col sm:flex-row items-center justify-between gap-4 mt-14 pt-6"
          style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
        >
          <p className="text-xs" style={{ color: '#374151' }}>
            © {year} Lex.ia — Todos los derechos reservados. Lima, Perú.
          </p>
          <div className="flex items-center gap-5">
            {['Términos', 'Privacidad', 'Cookies'].map((item, i) => (
              <a
                key={i}
                href="#"
                className="text-xs transition-colors hover:text-white"
                style={{ color: '#374151', textDecoration: 'none' }}
              >
                {item}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}
