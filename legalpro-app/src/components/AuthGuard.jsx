import { Navigate, useLocation } from 'react-router-dom';
import { useTenant } from '../context/TenantContext';

export default function AuthGuard({ children }) {
  const { isAuthenticated, organizacion } = useTenant();
  const location = useLocation();

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  // Usuario autenticado pero sin organización → setup obligatorio
  if (!organizacion && location.pathname !== '/setup-organizacion') {
    return <Navigate to="/setup-organizacion" replace />;
  }

  return children;
}
