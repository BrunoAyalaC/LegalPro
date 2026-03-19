import { useNavigate } from 'react-router-dom';

const logoImg = '/landing/assets/img/logo-icon.jpeg';
const APK_URL = import.meta.env.VITE_APK_URL ?? null;

const STEPS = [
  { n: '1', text: 'Descarga el archivo APK desde este enlace' },
  { n: '2', text: 'Abre el archivo desde la carpeta de Descargas' },
  { n: '3', text: 'Permite instalar apps de orígenes desconocidos si se solicita' },
  { n: '4', text: 'Inicia sesión con tu cuenta Lex.ia' },
];

const FEATURES = [
  { icon: '⚖️', label: 'Análisis de expedientes con IA' },
  { icon: '🔮', label: 'Predictor judicial en tiempo real' },
  { icon: '✍️', label: 'Redacción legal NCPP/CPC' },
  { icon: '🎭', label: 'Simulador de juicios orales' },
  { icon: '🔔', label: 'Monitor SINOE integrado' },
  { icon: '📚', label: 'Buscador de jurisprudencia' },
];

export default function Descargar() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'linear-gradient(135deg, #050508 0%, #080d14 100%)',
      fontFamily: "'Inter', sans-serif",
      color: '#f8fafc',
      position: 'relative',
    }}>
      {/* Ambient glow */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 60% 50% at 50% -10%, rgba(6,182,212,0.12), transparent)',
      }} />

      {/* Top navbar */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: 'rgba(5,5,8,0.85)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 clamp(16px, 4vw, 48px)', height: 64,
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'rgba(255,255,255,0.6)', fontSize: 14, fontWeight: 500,
            padding: '6px 10px 6px 4px', borderRadius: 8,
            transition: 'color 0.2s',
          }}
          onMouseOver={e => e.currentTarget.style.color = '#fff'}
          onMouseOut={e => e.currentTarget.style.color = 'rgba(255,255,255,0.6)'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle' }}>arrow_back</span>
          Volver
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <img src={logoImg} alt="Lex.ia" style={{ width: 32, height: 32, borderRadius: 8, objectFit: 'contain' }} />
          <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: '-0.5px' }}>
            Lex.<span style={{ color: '#06B6D4' }}>ia</span>
          </span>
        </div>

        <a
          href="/login"
          style={{
            fontSize: 13, fontWeight: 600, color: '#06B6D4',
            textDecoration: 'none', padding: '7px 16px',
            border: '1px solid rgba(6,182,212,0.35)', borderRadius: 10,
            transition: 'all 0.2s',
          }}
        >
          Iniciar sesión
        </a>
      </nav>

      {/* Main content */}
      <main style={{
        position: 'relative', zIndex: 1,
        maxWidth: 1100, margin: '0 auto',
        padding: 'clamp(32px, 5vw, 72px) clamp(16px, 4vw, 48px)',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: 48, alignItems: 'start',
      }}>
        {/* Left column: download card */}
        <div>
          <div style={{ marginBottom: 12 }}>
            <span style={{
              fontSize: 11, fontWeight: 700, letterSpacing: '2px',
              color: '#06B6D4', textTransform: 'uppercase',
            }}>App nativa · Android</span>
          </div>
          <h1 style={{
            fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 900,
            lineHeight: 1.15, marginBottom: 16,
            fontFamily: "'Plus Jakarta Sans', sans-serif", letterSpacing: '-1px',
          }}>
            Descarga<br/>
            <span style={{ color: '#06B6D4' }}>LegalPro</span>
          </h1>
          <p style={{ fontSize: 15, color: 'rgba(203,213,225,0.75)', lineHeight: 1.7, marginBottom: 32, maxWidth: 400 }}>
            La plataforma legal con IA más avanzada del Perú, ahora en tu celular. Requiere Android 8.0+.
          </p>

          {/* Download card */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: 20, padding: '28px 24px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            marginBottom: 24,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
              <div style={{
                width: 56, height: 56, borderRadius: 16,
                background: 'rgba(6,182,212,0.1)',
                border: '1px solid rgba(6,182,212,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 28,
              }}>🤖</div>
              <div>
                <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>Android APK</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                  Android 8.0+ · Gratis · Sin Play Store
                </div>
              </div>
            </div>

            {APK_URL ? (
              <a
                href={APK_URL}
                download="LegalPro.apk"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  width: '100%', padding: '14px 24px',
                  borderRadius: 14, border: 'none', cursor: 'pointer',
                  background: 'linear-gradient(135deg, #06B6D4 0%, #0891b2 100%)',
                  color: '#fff', fontSize: 15, fontWeight: 700,
                  textDecoration: 'none',
                  boxShadow: '0 4px 24px rgba(6,182,212,0.4)',
                  transition: 'all 0.2s ease',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 20 }}>download</span>
                Descargar APK — Gratis
              </a>
            ) : (
              <div style={{
                padding: '14px 24px', borderRadius: 14, textAlign: 'center',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'rgba(255,255,255,0.35)', fontSize: 14, fontWeight: 500,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18, verticalAlign: 'middle', marginRight: 6 }}>schedule</span>
                Próximamente disponible
              </div>
            )}

            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', marginTop: 12, textAlign: 'center' }}>
              Activa &ldquo;Instalar apps de orígenes desconocidos&rdquo; en Ajustes antes de instalar.
            </p>
          </div>

          {/* Version info badges */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { icon: '🔒', text: 'Encriptado SSL' },
              { icon: '🆓', text: 'Sin costo' },
              { icon: '📱', text: 'Android 8.0+' },
            ].map(({ icon, text }) => (
              <div key={text} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 20,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                fontSize: 12, color: 'rgba(255,255,255,0.55)',
              }}>
                <span>{icon}</span> {text}
              </div>
            ))}
          </div>
        </div>

        {/* Right column: steps + features */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Installation steps */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20, padding: '24px',
          }}>
            <h2 style={{
              fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#06B6D4' }}>install_mobile</span>
              Pasos de instalación
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {STEPS.map(({ n, text }) => (
                <div key={n} style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: 'rgba(6,182,212,0.12)',
                    border: '1px solid rgba(6,182,212,0.3)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 700, color: '#06B6D4',
                  }}>{n}</div>
                  <p style={{ fontSize: 14, color: 'rgba(203,213,225,0.75)', lineHeight: 1.6, paddingTop: 4 }}>{text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Features grid */}
          <div style={{
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 20, padding: '24px',
          }}>
            <h2 style={{
              fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 20,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#C9A84C' }}>auto_awesome</span>
              13 herramientas incluidas
            </h2>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
              gap: 10,
            }}>
              {FEATURES.map(({ icon, label }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '10px 12px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  fontSize: 12, color: 'rgba(203,213,225,0.8)',
                }}>
                  <span style={{ fontSize: 16 }}>{icon}</span>
                  {label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{
        position: 'relative', zIndex: 1,
        borderTop: '1px solid rgba(255,255,255,0.05)',
        textAlign: 'center', padding: '24px',
        fontSize: 12, color: 'rgba(255,255,255,0.25)',
      }}>
        © 2026 · Lex.ia Legal Platform · Lima, Perú
      </footer>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@700;800;900&display=swap');
      `}</style>
    </div>
  );
}
