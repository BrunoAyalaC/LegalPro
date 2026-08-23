import { Navigate, useLocation } from 'react-router-dom';
import { useTenant } from '../context/TenantContext';

export default function AuthGuard({ children }) {
  const { isAuthenticated, organizacion, isLoading } = useTenant();
  const location = useLocation();

  // Durante la rehidratación de sesión desde la cookie HttpOnly (/auth/me)
  // el token aún no está disponible. Esperar evita expulsar al usuario al
  // /login en cada refresh duro de una ruta protegida.
  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0b1120',
          color: '#94a3b8',
          fontFamily: 'system-ui, sans-serif',
        }}
      >
        <span
          style={{
            width: 36,
            height: 36,
            border: '3px solid rgba(148,163,184,0.25)',
            borderTopColor: '#3b82f6',
            borderRadius: '50%',
            animation: 'authguard-spin 0.8s linear infinite',
          }}
        />
        <style>{'@keyframes authguard-spin{to{transform:rotate(360deg)}}'}</style>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Usuario autenticado pero sin organización → setup obligatorio
  if (!organizacion && location.pathname !== '/setup-organizacion') {
    return <Navigate to="/setup-organizacion" replace />;
  }

  return children;
}
