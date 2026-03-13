import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { FileText, AlertTriangle, Shield, TrendingUp, ChevronRight, Clock, User } from 'lucide-react'

const casos = [
  {
    id: 'caso-1',
    tipo: 'PENAL',
    tipoColor: '#EF4444',
    titulo: 'Estafa Agravada — Art. 196-A CP',
    expediente: 'Exp. #2024-12345-Lima',
    descripcion: 'Acusación fiscal por estafa agravada. Empresa de inversiones captó S/480,000 de 23 víctimas bajo promesas de rentabilidad falsa.',
    fiscal: 'Fiscalía Especializada en Delitos Económicos - Lima',
    abogado: 'Defensa técnica privada',
    analisisIA: {
      riesgoCondena: 73,
      anosProbables: '6-8 años',
      precedentes: 312,
      defensas: [
        { tipo: 'Tipicidad', texto: 'El dolo deceptivo no está plenamente acreditado (R.N. 4539-2019)', icon: Shield, color: '#10B981' },
        { tipo: 'Prescripción', texto: 'Plazo ordinario Art. 80 CP - verificar fecha del primer acto', icon: Clock, color: '#F59E0B' },
        { tipo: 'Prueba pericial', texto: 'Peritaje contable con inconsistencias metodológicas', icon: AlertTriangle, color: '#00E5FF' },
      ],
      jurisprudencia: ['R.N. 4539-2019 (CS)', 'STC 0006-2006-PC (TC)', 'R.N. 789-2022 (CS)'],
    },
  },
  {
    id: 'caso-2',
    tipo: 'CIVIL',
    tipoColor: '#00E5FF',
    titulo: 'Desalojo por Vencimiento de Contrato',
    expediente: 'Exp. #2024-8891-Callao',
    descripcion: 'Arrendador solicita desalojo de inquilino que ocupa bien inmueble 18 meses después del vencimiento del contrato de arrendamiento.',
    fiscal: 'N/A (proceso civil)',
    abogado: 'Abogado del arrendador',
    analisisIA: {
      riesgoCondena: 88,
      anosProbables: '2-4 meses (sentencia favorable)',
      precedentes: 547,
      defensas: [
        { tipo: 'Proceso sumarísimo', texto: 'Competente el Juzgado de Paz Letrado (Art. 546 CPC)', icon: FileText, color: '#00E5FF' },
        { tipo: 'Pretensión clara', texto: 'Título de propiedad + contrato vencido = prueba suficiente', icon: Shield, color: '#10B981' },
        { tipo: 'Plazo acelerado', texto: 'D.Leg. 1231 permite proceso de desalojo express en 15 días', icon: TrendingUp, color: '#F59E0B' },
      ],
      jurisprudencia: ['Cas. 1234-2022-Lima (CS)', 'Cas. 789-2021-Arequipa (CS)', 'Pleno Casatorio - 6to'],
    },
  },
  {
    id: 'caso-3',
    tipo: 'LABORAL',
    tipoColor: '#10B981',
    titulo: 'Despido Incausado — Reposición',
    expediente: 'Exp. #2024-5567-Lima',
    descripcion: 'Trabajador con 7 años de antigüedad fue despedido verbalmente sin carta notarial ni expresión de causa. Solicita reposición.',
    fiscal: 'N/A (proceso laboral)',
    abogado: 'Defensa del trabajador',
    analisisIA: {
      riesgoCondena: 91,
      anosProbables: 'Reposición + 4-8 meses remuneraciones',
      precedentes: 891,
      defensas: [
        { tipo: 'Despido incausado', texto: 'STC 976-2001-AA (TC) - Protección contra despido arbitrario', icon: Shield, color: '#10B981' },
        { tipo: 'Prueba del vínculo', texto: 'Boletas de pago + control de asistencia = vínculo acreditado', icon: FileText, color: '#00E5FF' },
        { tipo: 'Remuneraciones devengadas', texto: 'Art. 40 LPCL + intereses legales calculados automáticamente', icon: TrendingUp, color: '#F59E0B' },
      ],
      jurisprudencia: ['STC 976-2001-AA (TC)', 'STC 3070-2013 (TC)', 'Cas. Lab. 2345-2022 (CS)'],
    },
  },
]

function CasoCard({ caso, isActive, onClick }) {
  const colorMap = { PENAL: '#EF4444', CIVIL: '#00E5FF', LABORAL: '#10B981' }
  const color = colorMap[caso.tipo]
  return (
    <motion.button
      whileHover={{ x: 4 }}
      onClick={onClick}
      className="w-full text-left p-4 rounded-xl transition-all"
      style={{
        background: isActive ? `${color}12` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isActive ? `${color}40` : 'rgba(255,255,255,0.07)'}`,
      }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ background: `${color}20`, color }}>
          {caso.tipo}
        </span>
        {isActive && <ChevronRight size={14} color={color} />}
      </div>
      <p className="text-sm font-semibold text-white leading-tight">{caso.titulo}</p>
      <p className="text-xs text-slate-500 mt-1">{caso.expediente}</p>
    </motion.button>
  )
}

function CasoDetalle({ caso }) {
  const color = caso.tipoColor
  return (
    <motion.div
      key={caso.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col gap-5"
    >
      {/* Header Caso */}
      <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <span className="text-xs font-bold px-2 py-1 rounded mb-2 inline-block" style={{ background: `${color}20`, color }}>
              {caso.tipo} · {caso.expediente}
            </span>
            <h3 className="text-lg font-bold text-white" style={{ fontFamily: 'Space Grotesk' }}>{caso.titulo}</h3>
          </div>
        </div>
        <p className="text-sm text-slate-400 leading-relaxed">{caso.descripcion}</p>
        <div className="flex gap-4 mt-3 text-xs text-slate-500">
          <span className="flex items-center gap-1"><User size={11} /> {caso.abogado}</span>
        </div>
      </div>

      {/* Resultado IA */}
      <div className="p-5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="flex items-center gap-2 mb-4">
          <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />
          <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Análisis Lex.ia</span>
        </div>

        {/* Stats rápidos */}
        <div className="grid grid-cols-3 gap-3 mb-5">
          <div className="text-center p-3 rounded-xl" style={{ background: `${color}10`, border: `1px solid ${color}20` }}>
            <p className="text-2xl font-extrabold" style={{ color, fontFamily: 'Space Grotesk' }}>{caso.analisisIA.riesgoCondena}%</p>
            <p className="text-xs text-slate-400 mt-0.5">Probabilidad favorable</p>
          </div>
          <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-lg font-extrabold text-white" style={{ fontFamily: 'Space Grotesk' }}>{caso.analisisIA.precedentes}</p>
            <p className="text-xs text-slate-400 mt-0.5">Casos similares</p>
          </div>
          <div className="text-center p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
            <p className="text-xs font-bold text-white mt-1">{caso.analisisIA.anosProbables}</p>
            <p className="text-xs text-slate-400 mt-0.5">Proyección</p>
          </div>
        </div>

        {/* Estrategias */}
        <div className="flex flex-col gap-3 mb-4">
          {caso.analisisIA.defensas.map((d) => {
            const DIcon = d.icon
            return (
              <div key={d.tipo} className="flex items-start gap-3 p-3 rounded-xl"
                style={{ background: `${d.color}08`, border: `1px solid ${d.color}20` }}>
                <DIcon size={16} color={d.color} className="mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs font-semibold" style={{ color: d.color }}>{d.tipo}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{d.texto}</p>
                </div>
              </div>
            )
          })}
        </div>

        {/* Jurisprudencia */}
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Jurisprudencia aplicable</p>
          <div className="flex flex-wrap gap-2">
            {caso.analisisIA.jurisprudencia.map((j) => (
              <span key={j} className="text-xs px-2 py-1 rounded-lg"
                style={{ background: 'rgba(0,229,255,0.08)', color: '#22D3EE', border: '1px solid rgba(0,229,255,0.15)' }}>
                {j}
              </span>
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

export default function CasosReales() {
  const [activo, setActivo] = useState(casos[0])
  const { ref, inView } = useInView({ triggerOnce: true, threshold: 0.05 })

  return (
    <section ref={ref} id="casos-reales" className="relative py-24 overflow-hidden">
      <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #0D1545 0%, #111B5E 50%, #0D1545 100%)' }} />
      <div className="absolute top-1/2 right-0 w-[500px] h-[500px] rounded-full opacity-10 blur-[120px] -translate-y-1/2"
        style={{ background: 'radial-gradient(ellipse, #00E5FF 0%, transparent 70%)' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ duration: 0.7 }}
          className="text-center mb-14">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold uppercase tracking-widest mb-6"
            style={{ background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.25)', color: '#00E5FF' }}>
            <FileText size={14} /> Casos de Uso Reales
          </span>
          <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-4" style={{ fontFamily: 'Space Grotesk, sans-serif' }}>
            Así analiza Lex.ia <span style={{ color: '#00E5FF' }}>tu expediente</span>
          </h2>
          <p className="text-lg text-slate-400 max-w-2xl mx-auto">
            Selecciona un tipo de caso y ve cómo Lex.ia identifica riesgos, estrategias y jurisprudencia aplicable en segundos.
          </p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 30 }} animate={inView ? { opacity: 1, y: 0 } : {}} transition={{ delay: 0.2, duration: 0.6 }}
          className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Lista de casos */}
          <div className="flex flex-col gap-3">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Selecciona un caso</p>
            {casos.map((c) => (
              <CasoCard key={c.id} caso={c} isActive={activo.id === c.id} onClick={() => setActivo(c)} />
            ))}
            <div className="mt-4 p-4 rounded-xl text-center text-xs text-slate-500"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.08)' }}>
              <span style={{ color: '#A78BFA' }}>+ 47 tipos de casos</span> disponibles en Lex.ia<br />
              Penal · Civil · Laboral · Tributario · Familia · Administrativo
            </div>
          </div>

          {/* Detalle del caso */}
          <div className="lg:col-span-2">
            <AnimatePresence mode="wait">
              <CasoDetalle key={activo.id} caso={activo} />
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
