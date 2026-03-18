import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { api } from '../api/client';

const TenantContext = createContext(null);

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch {
    return null;
  }
}

function buildStateFromPayload(payload) {
  if (!payload) return { usuario: null, organizacion: null };

  const usuario = {
    id: payload.sub ?? payload.id ?? null,
    email: payload.email ?? null,
    nombreCompleto: payload.nombre_completo ?? payload.nombre ?? payload.email ?? 'Usuario',
    rol: payload.rol ?? 'ABOGADO',
    especialidad: payload.especialidad ?? null,
  };

  const organizacion = payload.organization_id
    ? {
        id: payload.organization_id,
        nombre: payload.organization_name ?? 'Mi Firma Legal',
        slug: payload.organization_slug ?? null,
        plan: payload.plan ?? 'FREE',
        maxUsuarios: payload.usuarios_max ?? 3,
        expedientesMax: payload.expedientes_max ?? 5,
        expedientesUsados: payload.expedientes_usados ?? 0,
        usuariosUsados: payload.usuarios_usados ?? 1,
        rolOrg: payload.rol_org ?? null,
        isOrgAdmin: payload.rol_org === 'ADMIN',
      }
    : null;

  return { usuario, organizacion };
}

function loadFromStorage() {
  const token = localStorage.getItem('legalpro_token');
  if (!token) return { token: null, usuario: null, organizacion: null };
  const payload = parseJwt(token);
  if (payload?.exp && payload.exp * 1000 < Date.now()) {
    localStorage.removeItem('legalpro_token');
    return { token: null, usuario: null, organizacion: null };
  }
  const { usuario, organizacion } = buildStateFromPayload(payload);
  return { token, usuario, organizacion };
}

export function TenantProvider({ children }) {
  const [state, setState] = useState(() => loadFromStorage());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const login = useCallback(async (email, password) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.login(email, password);
      const token = data.token;
      const payload = parseJwt(token);
      const { usuario, organizacion } = buildStateFromPayload(payload);
      localStorage.setItem('legalpro_token', token);
      setState({ token, usuario, organizacion });
      return { token, usuario, organizacion };
    } catch (err) {
      const msg = err.message?.includes('401')
        ? 'Credenciales incorrectas. Verifica tu email y contraseña.'
        : 'No se pudo conectar al servidor. Intenta nuevamente.';
      setError(msg);
      throw new Error(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('legalpro_token');
    setState({ token: null, usuario: null, organizacion: null });
    setError(null);
  }, []);

  /**
   * Refresca el JWT llamando a /auth/me para obtener Claims actualizados
   * (p.ej. después de crear o unirse a una organización).
   */
  const refreshToken = useCallback(async () => {
    try {
      const data = await api.me();
      if (data?.token) {
        const payload = parseJwt(data.token);
        const { usuario, organizacion } = buildStateFromPayload(payload);
        localStorage.setItem('legalpro_token', data.token);
        setState({ token: data.token, usuario, organizacion });
      }
    } catch {
      // Si falla el refresh no cerramos sesión — el token actual sigue válido
    }
  }, []);

  const value = useMemo(
    () => ({
      token: state.token,
      usuario: state.usuario,
      organizacion: state.organizacion,
      isAuthenticated: !!state.token,
      isLoading,
      error,
      login,
      logout,
      refreshToken,
    }),
    [state, isLoading, error, login, logout, refreshToken],
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (ctx === null) throw new Error('useTenant debe usarse dentro de TenantProvider');
  return ctx;
}
