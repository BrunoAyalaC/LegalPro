import { Link } from 'react-router-dom';
import { useSeo } from '../hooks/useSeo';

/**
 * Página pública — Política de Privacidad v4.0 (conforme Ley N.º 29733)
 *
 * BUG B3: la política anterior mencionaba "Google Cloud (API Gemini)" como
 * proveedor de IA. Gemini fue ELIMINADO. Los proveedores reales son:
 * DeepSeek V4 Flash (OpenCode Go), MiMo V2.5 (OpenCode Go), Qwen VL
 * (OpenRouter) y MiniMax (fallback), con procesamiento en servidores en
 * China / EE.UU. según proveedor.
 *
 * Esta página es pública (sin autenticación) y es la que responde la ruta
 * /legal/privacidad del SPA.
 */

const PROVEEDORES_IA = [
  {
    nombre: 'DeepSeek V4 Flash',
    via: 'OpenCode Go',
    pais: 'China / EE.UU.',
    uso: 'Modelo principal: razonamiento, análisis, redacción legal y chat general.',
    detalles:
      'Procesa los prompts de consulta en servidores administrados por el proveedor; los datos pueden residir o procesarse fuera del Perú.',
  },
  {
    nombre: 'MiMo V2.5',
    via: 'OpenCode Go',
    pais: 'China / EE.UU.',
    uso: 'Modelo gratuito (free tier): visión, OCR y análisis de evidencia en documentos.',
    detalles:
      'Procesa imágenes y documentos de evidencia; puede implicar transferencia internacional de los datos contenidos en ellos.',
  },
  {
    nombre: 'Qwen VL',
    via: 'OpenRouter',
    pais: 'China / EE.UU.',
    uso: 'Modelo de visión (VL): análisis multimodal de documentos e imágenes.',
    detalles:
      'Las consultas se envían a la plataforma OpenRouter, que puede enrutar el procesamiento a servidores en China o Estados Unidos.',
  },
  {
    nombre: 'MiniMax',
    via: 'MiniMax',
    pais: 'China',
    uso: 'Proveedor fallback: se activa solo si los proveedores principales no están disponibles.',
    detalles:
      'Servicios de respaldo con servidores ubicados en China; procesa consultas solo en escenarios de contingencia.',
  },
];

const SECCIONES = [
  {
    id: 'responsable',
    titulo: '1. Responsable del Tratamiento',
    contenido: (
      <div className="space-y-4">
        <p>
          El responsable del tratamiento de los datos personales es{' '}
          <strong>LegalPro S.A.C.</strong>, identificada con R.U.C. 20601234567,
          con domicilio en Av. Javier Prado Este 123, Lima, Perú.
        </p>
        <p>
          Tratamos sus datos en estricto cumplimiento de la{' '}
          <strong>Ley N.º 29733 — Ley de Protección de Datos Personales</strong>,
          su Reglamento (D.S. 003-2013-JUS) y las directrices de la Autoridad
          Nacional de Protección de Datos Personales (ANPD).
        </p>
      </div>
    ),
  },
  {
    id: 'proveedores',
    titulo: '2. Proveedores de Inteligencia Artificial',
    contenido: (
      <div className="space-y-4">
        <p>
          Para el funcionamiento de las herramientas de IA, el contenido de los
          chats, prompts, documentos e imágenes que usted ingresa puede ser
          enviado a los siguientes proveedores de modelos de lenguaje:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-cyan-500/20">
                <th scope="col" className="text-left py-2 pr-3 text-cyan-300 font-semibold">Proveedor</th>
                <th scope="col" className="text-left py-2 pr-3 text-cyan-300 font-semibold">Plataforma</th>
                <th scope="col" className="text-left py-2 pr-3 text-cyan-300 font-semibold">Ubicación de servidores</th>
                <th scope="col" className="text-left py-2 text-cyan-300 font-semibold">Finalidad</th>
              </tr>
            </thead>
            <tbody>
              {PROVEEDORES_IA.map((p) => (
                <tr key={p.nombre} className="border-b border-white/5 align-top">
                  <td className="py-3 pr-3 text-white font-semibold">{p.nombre}</td>
                  <td className="py-3 pr-3 text-white/70">{p.via}</td>
                  <td className="py-3 pr-3 text-white/70">{p.pais}</td>
                  <td className="py-3 text-white/70">{p.uso}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm text-white/60">
          Cada proveedor puede tener servidores ubicados en <strong>China y/o Estados Unidos</strong>,
          por lo que sus datos pueden ser procesados fuera del territorio peruano.
        </p>
      </div>
    ),
  },
  {
    id: 'transferencia',
    titulo: '3. Transferencia Internacional de Datos',
    contenido: (
      <div className="space-y-4">
        <p>
          De conformidad con el <strong>artículo 21 de la Ley N.º 29733</strong>, la
          transferencia internacional de datos personales requiere el{' '}
          <strong>consentimiento expreso, libre, previo, informado e inequívoco</strong>{' '}
          del titular.
        </p>
        <p>
          Al aceptar esta política de privacidad y utilizar las herramientas de IA, usted
          otorga su consentimiento expreso para que el contenido de sus consultas, chats y
          documentos pueda ser procesado por los proveedores de IA descritos en la sección
          anterior, con servidores ubicados en <strong>China y/o Estados Unidos</strong>.
        </p>
        <ul className="list-disc list-inside space-y-2 text-white/70">
          <li>
            <strong className="text-white">Consentimiento informado:</strong> se le informa
            claramente sobre los destinatarios, la ubicación de los servidores y la finalidad
            del tratamiento.
          </li>
          <li>
            <strong className="text-white">Minimización:</strong> solo se envía al proveedor el
            contenido estrictamente necesario para generar la respuesta solicitada; los
            expedientes completos no se comparten con terceros.
          </li>
          <li>
            <strong className="text-white">No reentrenamiento:</strong> las consultas de los
            usuarios no se utilizan para reentrenar modelos ajenos sin anonimización previa.
          </li>
          <li>
            <strong className="text-white">Datos sensibles:</strong> no se transfieren datos
            sensibles sin anonimización previa y consentimiento explícito.
          </li>
          <li>
            <strong className="text-white">Revocatoria:</strong> usted puede revocar este
            consentimiento en cualquier momento, lo que limitará el uso de las herramientas de
            IA, sin afectar el resto del servicio.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 'arco',
    titulo: '4. Derechos ARCO',
    contenido: (
      <div className="space-y-4">
        <p>
          Conforme a los <strong>artículos 18 y 19 de la Ley N.º 29733</strong>, usted tiene
          derecho a:
        </p>
        <ul className="list-disc list-inside space-y-2 text-white/70">
          <li>
            <strong className="text-white">Acceso:</strong> conocer qué datos personales suyos
            tratamos y cómo los utilizamos.
          </li>
          <li>
            <strong className="text-white">Rectificación:</strong> solicitar la corrección de
            datos inexactos o incompletos.
          </li>
          <li>
            <strong className="text-white">Cancelación:</strong> solicitar la eliminación de sus
            datos cuando ya no sean necesarios para las finalidades informadas.
          </li>
          <li>
            <strong className="text-white">Oposición:</strong> oponerse al tratamiento de sus
            datos para fines específicos (p. ej., comunicaciones comerciales).
          </li>
        </ul>
        <p>
          Para ejercer estos derechos, envíe una solicitud al DPO indicado en la sección 8,
          adjuntando copia de su documento de identidad. El plazo máximo de atención es de{' '}
          <strong>20 días hábiles</strong>, prorrogable por única vez por un plazo igual cuando
          existan circunstancias que lo justifiquen.
        </p>
      </div>
    ),
  },
  {
    id: 'retencion',
    titulo: '5. Plazo de Conservación de Datos',
    contenido: (
      <div className="space-y-4">
        <p>
          Sus datos personales serán conservados mientras dure la relación contractual y su
          cuenta esté activa. Tras la baja del servicio:
        </p>
        <ul className="list-disc list-inside space-y-2 text-white/70">
          <li>
            Los datos personales identificativos serán <strong>eliminados o anonimizados</strong>{' '}
            en un plazo máximo de 30 días calendario.
          </li>
          <li>
            Los datos podrán conservarse de forma <strong>bloqueada</strong> por un período
            adicional de hasta 2 años únicamente para atender obligaciones legales, tributarias
            o auditorías normativas.
          </li>
          <li>
            Vencido ese plazo, la información será eliminada de forma irreversible.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 'seguridad',
    titulo: '6. Seguridad de la Información',
    contenido: (
      <div className="space-y-4">
        <p>
          Implementamos medidas técnicas, organizativas y legales para proteger sus datos:
        </p>
        <ul className="list-disc list-inside space-y-2 text-white/70">
          <li>
            <strong className="text-white">Cifrado en tránsito:</strong> TLS 1.3 en todas las
            comunicaciones cliente-servidor.
          </li>
          <li>
            <strong className="text-white">Cifrado en reposo:</strong> los datos se almacenan en
            PostgreSQL con cifrado a nivel de volumen (AES-256) y contraseñas con hash bcrypt
            (cost 12).
          </li>
          <li>
            <strong className="text-white">Aislamiento multi-tenant (RLS):</strong> políticas
            Row Level Security en base de datos que impiden que una organización acceda a los
            datos de otra.
          </li>
          <li>
            <strong className="text-white">Acceso restringido:</strong> principio de mínimo
            privilegio; solo personal autorizado con NDA firmado accede a la infraestructura.
          </li>
          <li>
            <strong className="text-white">Backups cifrados:</strong> copias diarias con cifrado
            AES-256.
          </li>
          <li>
            <strong className="text-white">Monitoreo y auditoría:</strong> registros de auditoría
            de accesos y detección de actividad anómala.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 'disclaimer',
    titulo: '7. Disclaimer de Inteligencia Artificial',
    contenido: (
      <div className="space-y-4">
        <p>
          Los resultados generados por las herramientas de IA de LegalPro son de carácter{' '}
          <strong>informativo y orientativo</strong>. No constituyen asesoría legal, opinión
          jurídica vinculante ni reemplazan el criterio profesional de un abogado colegiado.
        </p>
        <ul className="list-disc list-inside space-y-2 text-white/70">
          <li>
            La IA puede cometer errores, generar respuestas incompletas o citar normativa que no
            corresponda al caso concreto.
          </li>
          <li>
            Toda respuesta debe ser verificada contra la normativa vigente y la jurisprudencia
            oficial antes de su uso en un proceso judicial o administrativo.
          </li>
          <li>
            El usuario es responsable final del uso que dé a las respuestas generadas y de la
            decisión de presentarlas ante autoridades.
          </li>
          <li>
            No se garantiza la exactitud, integridad ni actualidad de los contenidos generados.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 'dpo',
    titulo: '8. Contacto del Oficial de Protección de Datos (DPO)',
    contenido: (
      <div className="space-y-4">
        <p>
          Para ejercer sus derechos ARCO, realizar consultas sobre el tratamiento de sus datos
          o reportar un incidente de seguridad, contacte a nuestro DPO:
        </p>
        <div className="rounded-xl bg-white/[0.03] border border-white/10 p-5 space-y-2 text-sm">
          <p>
            <strong className="text-cyan-300">Email:</strong>{' '}
            <a href="mailto:privacidad@legalpro.pe" className="text-cyan-300 underline underline-offset-2 hover:text-cyan-200">
              privacidad@legalpro.pe
            </a>
          </p>
          <p>
            <strong className="text-cyan-300">Asunto recomendado:</strong>{' '}
            <span className="text-white/70">"Solicitud Derechos ARCO — [Su nombre]"</span>
          </p>
          <p>
            <strong className="text-cyan-300">Tiempo de respuesta:</strong>{' '}
            <span className="text-white/70">Hasta 20 días hábiles conforme al Reglamento de la Ley N.º 29733.</span>
          </p>
          <p>
            <strong className="text-cyan-300">ANPD:</strong>{' '}
            <span className="text-white/70">
              De no ser atendida su solicitud, puede presentar una denuncia ante la Dirección de
              Fiscalización e Instrucción de la ANPD (MINJUSDH).
            </span>
          </p>
        </div>
      </div>
    ),
  },
];

export default function Privacidad() {
  useSeo({
    title: 'Política de Privacidad — LexIA',
    description:
      'Política de Privacidad de LexIA conforme a la Ley N.º 29733 (Perú): proveedores de IA (DeepSeek V4 Flash, MiMo V2.5, Qwen VL, MiniMax), transferencia internacional de datos, derechos ARCO, retención y seguridad.',
  });

  return (
    <div
      className="min-h-dvh text-slate-100"
      style={{ background: 'linear-gradient(135deg, #050508 0%, #080d14 100%)' }}
    >
      {/* Ambient glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          background:
            'radial-gradient(ellipse 60% 50% at 50% -10%, rgba(6,182,212,0.10), transparent)',
        }}
      />

      {/* Navbar */}
      <nav
        className="sticky top-0 z-50 border-b border-white/[0.06]"
        style={{ background: 'rgba(5,5,8,0.85)', backdropFilter: 'blur(20px)' }}
      >
        <div className="mx-auto flex h-16 max-w-4xl items-center justify-between px-6">
          <Link
            to="/"
            className="flex items-center gap-2 text-sm font-medium text-white/60 transition-colors hover:text-white"
            aria-label="Volver al inicio"
          >
            <span aria-hidden="true" className="material-symbols-outlined" style={{ fontSize: 18 }}>arrow_back</span>
            Volver al inicio
          </Link>
          <div className="flex items-center gap-2">
            <span className="text-lg font-extrabold tracking-tight">
              Lex<span style={{ color: '#06B6D4' }}>.ia</span>
            </span>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <header className="relative px-6 pb-8 pt-14 text-center">
        <div className="mx-auto max-w-3xl">
          <div
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-[rgba(201,168,76,0.20)] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em]"
            style={{ background: 'rgba(201,168,76,0.08)', color: '#C9A84C' }}
          >
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: '#C9A84C' }} />
            Conforme a la Ley N.º 29733 — Perú
          </div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            Política de Privacidad
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/50">
            En LexIA protegemos sus datos personales conforme a la Ley de Protección de Datos
            Personales del Perú (Ley N.º 29733) y su Reglamento.
          </p>
          <p className="mt-4 text-[11px] text-white/30">
            Versión 4.0 · Última actualización: 12 de agosto de 2026
          </p>
        </div>
      </header>

      {/* Content */}
      <main className="relative mx-auto max-w-3xl px-6 pb-24">
        <article
          className="rounded-2xl border border-white/10 p-8 md:p-10"
          style={{ background: 'rgba(255,255,255,0.03)', backdropFilter: 'blur(16px)' }}
        >
          {SECCIONES.map((s) => (
            <section key={s.id} id={s.id} className="mb-10 last:mb-0">
              <h2
                className="mb-4 text-xl font-bold text-white"
                style={{ borderLeft: '3px solid #C9A84C', paddingLeft: '10px' }}
              >
                {s.titulo}
              </h2>
              {s.contenido}
            </section>
          ))}
        </article>

        {/* Footer links */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-5 text-xs text-white/40">
          <Link to="/" className="transition-colors hover:text-white/70">Inicio</Link>
          <span aria-hidden="true">·</span>
          <a href="/terminos.html" target="_blank" rel="noopener noreferrer" className="transition-colors hover:text-white/70">
            Términos y Condiciones
          </a>
          <span aria-hidden="true">·</span>
          <span className="text-white/60">Privacidad</span>
        </div>

        <p className="mt-6 text-center text-xs text-white/25">
          © 2026 LegalPro S.A.C. — R.U.C. 20601234567. Lima, Perú.
        </p>
      </main>
    </div>
  );
}
