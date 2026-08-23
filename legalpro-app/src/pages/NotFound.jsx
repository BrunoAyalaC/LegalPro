import { Link } from 'react-router-dom';

/**
 * Página 404 — ruta catch-all.
 * Se renderiza para cualquier ruta no registrada en el router.
 */
export default function NotFound() {
  return (
    <div
      style={{
        minHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: '24px',
        background: 'linear-gradient(135deg, #050508 0%, #080d14 100%)',
        fontFamily: "'Inter', sans-serif",
        color: '#f8fafc',
        textAlign: 'center',
      }}
    >
      <p
        role="status"
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: 3,
          textTransform: 'uppercase',
          color: '#22D3EE',
          margin: 0,
        }}
      >
        Error 404
      </p>
      <h1
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: 'clamp(32px, 6vw, 56px)',
          fontWeight: 900,
          letterSpacing: '-1.5px',
          lineHeight: 1.1,
          margin: 0,
        }}
      >
        Página no encontrada
      </h1>
      <p style={{ fontSize: 17, color: '#8896A8', maxWidth: 440, margin: 0, lineHeight: 1.6 }}>
        La ruta que buscas no existe o fue movida. Revisa la dirección o vuelve al inicio.
      </p>
      <nav aria-label="Enlaces de navegación">
        <Link
          to="/"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '13px 26px',
            borderRadius: 12,
            background: '#06B6D4',
            color: '#050508',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 15,
            fontWeight: 700,
            textDecoration: 'none',
            transition: 'background 0.2s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#22D3EE'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = '#06B6D4'; }}
        >
          Ir al inicio →
        </Link>
        <Link
          to="/dashboard"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '13px 26px',
            borderRadius: 12,
            border: '1.5px solid rgba(248,250,252,0.2)',
            color: '#f8fafc',
            fontFamily: "'Plus Jakarta Sans', sans-serif",
            fontSize: 15,
            fontWeight: 700,
            textDecoration: 'none',
            marginLeft: 12,
            transition: 'border-color 0.2s ease, background 0.2s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(6,182,212,0.6)'; e.currentTarget.style.background = 'rgba(6,182,212,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(248,250,252,0.2)'; e.currentTarget.style.background = 'transparent'; }}
        >
          Ir al dashboard
        </Link>
      </nav>
    </div>
  );
}
