import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
const logoImg = '/landing/assets/img/logo-icon.jpeg';
import { useTenant } from '../context/TenantContext';

/* ═══ Datos de los slides de onboarding ════════════════════════ */
const SLIDES = [
  {
    icon: 'psychology',
    tag: 'INTELIGENCIA ARTIFICIAL',
    headline: 'Análisis de Expedientes',
    sub: 'Sube cualquier PDF y Gemini AI extrae hechos, argumentos y puntos débiles en segundos. Lo que antes tomaba horas, ahora toma 30 segundos.',
    stat: '30s', statLabel: 'tiempo de análisis',
    accent: 'cyan',
  },
  {
    icon: 'balance',
    tag: 'PREDICCIÓN JUDICIAL',
    headline: 'Conoce el resultado antes del juicio',
    sub: 'Lex.ia analiza más de 50,000 sentencias del Poder Judicial peruano y predice el resultado más probable de tu caso con fundamento jurídico.',
    stat: '94%', statLabel: 'de precisión en predicciones',
    accent: 'gold',
  },
  {
    icon: 'edit_document',
    tag: 'REDACCIÓN LEGAL IA',
    headline: 'Escritos NCPP/CPC en minutos',
    sub: 'Genera demandas, apelaciones, recursos de casación y requerimientos fiscales con el lenguaje jurídico correcto para el sistema peruano.',
    stat: '13', statLabel: 'tipos de escritos generados',
    accent: 'cyan',
  },
  {
    icon: 'gavel',
    tag: 'SIMULADOR DE JUICIOS',
    headline: 'Practica antes de la audiencia',
    sub: 'Simula juicios orales completos donde la IA actúa como juez, fiscal o abogado defensor. Perfecciona tu estrategia NCPP sin riesgo.',
    stat: '4', statLabel: 'roles de IA en cada simulación',
    accent: 'gold',
  },
  {
    icon: 'notifications_active',
    tag: 'MONITOR SINOE',
    headline: 'Notificaciones del PJ en tiempo real',
    sub: 'Lex.ia monitorea el SINOE y te notifica al instante de cualquier resolución, proveído o notificación en tus expedientes activos.',
    stat: '24/7', statLabel: 'monitoreo continuo',
    accent: 'cyan',
  },
];

/* ═══ Componente Slide individual ══════════════════════════════ */
function OnboardingSlide({ slide, active }) {
  const isCyan = slide.accent === 'cyan';
  const accentHex  = isCyan ? '#06B6D4' : '#C9A84C';
  const accentGhost = isCyan ? 'rgba(6,182,212,0.12)' : 'rgba(201,168,76,0.12)';

  return (
    <div
      aria-hidden={!active}
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        justifyContent: 'center', padding: '0 52px',
        opacity: active ? 1 : 0,
        transform: active ? 'translateY(0) scale(1)' : 'translateY(20px) scale(0.97)',
        transition: 'opacity 0.55s cubic-bezier(.4,0,.2,1), transform 0.55s cubic-bezier(.4,0,.2,1)',
        pointerEvents: active ? 'auto' : 'none',
      }}
    >
      {/* Tag */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        marginBottom: 22,
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: '50%',
          background: accentHex,
          boxShadow: `0 0 8px ${accentHex}`,
        }} />
        <span style={{
          fontSize: 10, fontWeight: 700, letterSpacing: '2px',
          color: accentHex, textTransform: 'uppercase',
        }}>{slide.tag}</span>
      </div>

      {/* Icon circle */}
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: accentGhost,
        border: `1px solid ${accentHex}40`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 28,
        boxShadow: `0 0 30px ${accentHex}20`,
      }}>
        <span className="material-icons" style={{ fontSize: 34, color: accentHex }}>
          {slide.icon}
        </span>
      </div>

      {/* Headline */}
      <h2 style={{
        fontSize: 'clamp(22px,2.4vw,30px)', fontWeight: 800, lineHeight: 1.22,
        color: '#fff', marginBottom: 16, fontFamily: "'Plus Jakarta Sans',sans-serif",
      }}>
        {slide.headline}
      </h2>

      {/* Sub */}
      <p style={{
        fontSize: 15, lineHeight: 1.7, color: 'rgba(255,255,255,0.62)',
        maxWidth: 420, marginBottom: 36,
      }}>
        {slide.sub}
      </p>

      {/* Stat badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 14,
        background: accentGhost,
        border: `1px solid ${accentHex}30`,
        borderRadius: 14, padding: '12px 20px',
        width: 'fit-content',
      }}>
        <span style={{
          fontSize: 28, fontWeight: 900, color: accentHex,
          fontFamily: "'Plus Jakarta Sans',sans-serif",
        }}>{slide.stat}</span>
        <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.4 }}>
          {slide.statLabel}
        </span>
      </div>
    </div>
  );
}

/* ═══ LOGIN PRINCIPAL ══════════════════════════════════════════ */
export default function Login() {
  const navigate = useNavigate();
  const { login, isLoading: contextLoading } = useTenant();

  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  /* Auto-advance slides each 4s */
  useEffect(() => {
    const t = setInterval(() => {
      setActiveSlide(s => (s + 1) % SLIDES.length);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const handleLogin = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { organizacion } = await login(email, password);
      navigate(organizacion ? '/dashboard' : '/setup-organizacion');
    } catch (err) {
      setError(err.message ?? 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  }, [email, password, login, navigate]);

  const isSubmitting = loading || contextLoading;

  return (
    <div style={{
      minHeight: '100dvh', display: 'flex',
      background: '#050508', fontFamily: "'Inter',sans-serif",
    }}>
      {/* ── LEFT PANEL: Onboarding slides (oculto en mobile) ── */}
      <div style={{
        flex: '0 0 58%', position: 'relative',
        overflow: 'hidden', display: 'none',
      }}
        className="login-left-panel"
      >
        {/* Video-like gradient background */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(135deg, #050508 0%, #0a1220 40%, #050508 100%)',
        }} />
        {/* Blobs decorativos */}
        <div style={{
          position: 'absolute', width: 500, height: 500,
          borderRadius: '50%', top: -120, left: -120,
          background: 'radial-gradient(circle, rgba(6,182,212,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', width: 400, height: 400,
          borderRadius: '50%', bottom: -60, right: -60,
          background: 'radial-gradient(circle, rgba(201,168,76,0.07) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        {/* Mesh lines */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04 }}
          xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#06B6D4" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Logo + brand */}
        <div style={{
          position: 'absolute', top: 36, left: 52,
          display: 'flex', alignItems: 'center', gap: 12,
        }}>
          <img src={logoImg} alt="Lex.ia" style={{
            width: 40, height: 40, borderRadius: 10,
            objectFit: 'contain',
            boxShadow: '0 0 20px rgba(6,182,212,0.3)',
          }} />
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#fff', fontFamily: "'Plus Jakarta Sans',sans-serif", letterSpacing: '-0.5px' }}>
              Lex.<span style={{ color: '#06B6D4' }}>ia</span>
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>
              Legal AI Platform
            </div>
          </div>
        </div>

        {/* Slides container */}
        <div style={{ position: 'absolute', inset: 0, paddingTop: 100 }}>
          {SLIDES.map((slide, i) => (
            <OnboardingSlide key={i} slide={slide} active={i === activeSlide} />
          ))}
        </div>

        {/* Dot indicators */}
        <div style={{
          position: 'absolute', bottom: 40, left: 52,
          display: 'flex', gap: 8, alignItems: 'center',
        }}>
          {SLIDES.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveSlide(i)}
              aria-label={`Slide ${i + 1}`}
              style={{
                width: i === activeSlide ? 24 : 6,
                height: 6, borderRadius: 3,
                background: i === activeSlide ? '#06B6D4' : 'rgba(255,255,255,0.35)',
                border: 'none', cursor: 'pointer', padding: 0,
                transition: 'all 0.3s ease',
                boxShadow: i === activeSlide ? '0 0 8px #06B6D4' : 'none',
              }}
            />
          ))}
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginLeft: 8 }}>
            {activeSlide + 1} / {SLIDES.length}
          </span>
        </div>

        {/* Divider vertical */}
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: 1,
          background: 'linear-gradient(to bottom, transparent, rgba(6,182,212,0.15) 30%, rgba(6,182,212,0.15) 70%, transparent)',
        }} />
      </div>

      {/* ── RIGHT PANEL: Formulario de login ──────────────────── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px', position: 'relative', overflowY: 'auto',
      }}>
        {/* Background sutil en mobile */}
        <div style={{
          position: 'fixed', inset: 0, zIndex: -1,
          background: 'linear-gradient(135deg, #050508 0%, #080d14 100%)',
        }} />

        <div style={{ width: '100%', maxWidth: 380 }}>
          {/* Logo mobile (visible solo cuando ocultamos el panel izq.) */}
          <div className="login-mobile-logo" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            marginBottom: 36,
          }}>
            <div style={{
              width: 72, height: 72, borderRadius: 18,
              background: 'rgba(6,182,212,0.08)',
              border: '1px solid rgba(6,182,212,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14,
              boxShadow: '0 0 30px rgba(6,182,212,0.15)',
            }}>
              <img src={logoImg} alt="Lex.ia" style={{ width: 50, height: 50, objectFit: 'contain' }} />
            </div>
            <div style={{
              fontSize: 24, fontWeight: 800, color: '#fff',
              fontFamily: "'Plus Jakarta Sans',sans-serif", letterSpacing: '-0.5px',
            }}>
              Lex.<span style={{ color: '#06B6D4' }}>ia</span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 4 }}>
              Plataforma Legal con Inteligencia Artificial
            </div>
          </div>

          {/* Card de formulario */}
          <div style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 20, padding: '32px 28px',
            backdropFilter: 'blur(16px)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          }}>
            <h1 style={{
              fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 6,
              fontFamily: "'Plus Jakarta Sans',sans-serif",
            }}>Iniciar Sesión</h1>
            <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.65)', marginBottom: 24 }}>
              Ingresa tus credenciales para continuar
            </p>

            {/* Error */}
            {error && (
              <div style={{
                marginBottom: 16, padding: '12px 14px',
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.25)',
                borderRadius: 10, fontSize: 13,
                color: '#f87171', display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span className="material-icons" style={{ fontSize: 16 }}>error_outline</span>
                {error}
              </div>
            )}

            <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* Email */}
              <div>
                <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6, fontWeight: 500 }}>
                  Correo electrónico
                </label>
                <div style={{ position: 'relative' }}>
                  <span className="material-icons" style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 18, color: 'rgba(255,255,255,0.3)', pointerEvents: 'none',
                  }}>mail_outline</span>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    placeholder="tu@correo.com"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '12px 14px 12px 40px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      borderRadius: 12, fontSize: 14, color: '#fff',
                      outline: 'none', transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(6,182,212,0.5)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.10)'}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', display: 'block', marginBottom: 6, fontWeight: 500 }}>
                  Contraseña
                </label>
                <div style={{ position: 'relative' }}>
                  <span className="material-icons" style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 18, color: 'rgba(255,255,255,0.3)', pointerEvents: 'none',
                  }}>lock_outline</span>
                  <input
                    type={showPass ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '12px 44px 12px 40px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      borderRadius: 12, fontSize: 14, color: '#fff',
                      outline: 'none', transition: 'border-color 0.2s',
                    }}
                    onFocus={e => e.target.style.borderColor = 'rgba(6,182,212,0.5)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.10)'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(p => !p)}
                    style={{
                      position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                      color: 'rgba(255,255,255,0.35)',
                    }}
                  >
                    <span className="material-icons" style={{ fontSize: 18 }}>
                      {showPass ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Extras row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}>
                  <input type="checkbox" defaultChecked style={{ accentColor: '#06B6D4' }} />
                  Recordarme
                </label>
                <a href="#" style={{ fontSize: 12, color: '#06B6D4', textDecoration: 'none' }}>
                  ¿Olvidó su contraseña?
                </a>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  width: '100%', padding: '14px',
                  borderRadius: 12, border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  background: isSubmitting
                    ? 'rgba(6,182,212,0.4)'
                    : 'linear-gradient(135deg, #06B6D4 0%, #0891b2 100%)',
                  color: '#fff', fontSize: 15, fontWeight: 700,
                  fontFamily: "'Plus Jakarta Sans',sans-serif",
                  boxShadow: isSubmitting ? 'none' : '0 4px 20px rgba(6,182,212,0.35)',
                  transition: 'all 0.2s ease',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  marginTop: 4,
                }}
              >
                {isSubmitting ? (
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    animation: 'spin 0.7s linear infinite',
                  }} />
                ) : (
                  <>
                    <span className="material-icons" style={{ fontSize: 18 }}>login</span>
                    Iniciar Sesión
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Mini slides carousel (solo mobile) */}
          <div className="login-mobile-slides" style={{
            marginTop: 28, display: 'none',
            background: 'rgba(255,255,255,0.02)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: 16, padding: '20px 20px 16px',
            position: 'relative', overflow: 'hidden', minHeight: 130,
          }}>
            {SLIDES.map((slide, i) => {
              const isCyan = slide.accent === 'cyan';
              const accentHex = isCyan ? '#06B6D4' : '#C9A84C';
              return (
                <div key={i} style={{
                  position: 'absolute', inset: 0, padding: '20px 20px 16px',
                  opacity: i === activeSlide ? 1 : 0,
                  transition: 'opacity 0.4s ease',
                  pointerEvents: i === activeSlide ? 'auto' : 'none',
                }}>
                  <div style={{ fontSize: 10, color: accentHex, fontWeight: 700, letterSpacing: '1.5px', marginBottom: 8 }}>
                    {slide.tag}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 6 }}>
                    {slide.headline}
                  </div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
                    <span style={{ color: accentHex, fontWeight: 700, fontSize: 16 }}>{slide.stat}</span>
                    {' '}{slide.statLabel}
                  </div>
                </div>
              );
            })}
            {/* Dots mobile */}
            <div style={{ position: 'absolute', bottom: 10, right: 16, display: 'flex', gap: 5 }}>
              {SLIDES.map((_, i) => (
                <div key={i} style={{
                  width: i === activeSlide ? 16 : 5, height: 5, borderRadius: 3,
                  background: i === activeSlide ? '#06B6D4' : 'rgba(255,255,255,0.15)',
                  transition: 'all 0.3s ease',
                }} />
              ))}
            </div>
          </div>

          <p style={{ textAlign: 'center', fontSize: 11, color: 'rgba(255,255,255,0.25)', marginTop: 24 }}>
            Impulsado por Gemini AI &copy; 2026 · Lex.ia Legal Platform
          </p>
        </div>
      </div>

      {/* CSS inline para responsive + spinner */}
      <style>{`
        @import url('https://fonts.googleapis.com/icon?family=Material+Icons');
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap');
        @keyframes spin { to { transform: rotate(360deg); } }
        @media (min-width: 900px) {
          .login-left-panel { display: flex !important; }
          .login-mobile-logo { display: none !important; }
        }
        @media (max-width: 899px) {
          .login-mobile-slides { display: block !important; }
        }
        input::placeholder { color: rgba(255,255,255,0.22) !important; }
        input:-webkit-autofill { -webkit-box-shadow: 0 0 0 50px #0a0f1a inset !important; -webkit-text-fill-color: #fff !important; }
      `}</style>
    </div>
  );
}

