import { createContext, useContext, useState, useCallback, useMemo, type ReactNode } from 'react';
import { api } from '../api/client';
import type { TenantContextType, TenantState, LoginResult, Usuario, Organizacion } from '../types';

const TenantContext = createContext<TenantContextType | null>(null);

interface JwtPayload {
  sub?: string | number;
  id?: string | number;
  email?: string;
  nombre_completo?: string;
  nombre?: string;
  rol?: string;
  especialidad?: string;
  organization_id?: string | number;
  organization_name?: string;
  organization_slug?: string;
  plan?: string;
  usuarios_max?: number;
  expedientes_max?: number;
  expedientes_usados?: number;
  usuarios_usados?: number;
  rol_org?: string;
  exp?: number;
}

function parseJwt(token: string): JwtPayload | null {
  try {
    return JSON.parse(atob(token.split('.')[1])) as JwtPayload;
  } catch {
    return null;
  }
}

function buildStateFromPayload(payload: JwtPayload | null): Pick<TenantState, 'usuario' | 'organizacion'> {
  if (!payload) return { usuario: null, organizacion: null };

  const usuario: Usuario = {
    id: payload.sub ?? payload.id ?? null,
    email: payload.email ?? null,
    nombreCompleto: payload.nombre_completo ?? payload.nombre ?? payload.email ?? 'Usuario',
    rol: payload.rol ?? 'ABOGADO',
    especialidad: payload.especialidad ?? null,
  };

  const organizacion: Organizacion | null = payload.organization_id
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

function loadFromStorage(): TenantState {
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

export function TenantProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TenantState>(() => loadFromStorage());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
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
      const msg = (err as Error).message?.includes('401')
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

  const value = useMemo<TenantContextType>(
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

/* eslint-disable-next-line react-refresh/only-export-components */
export function useTenant(): TenantContextType {
  const ctx = useContext(TenantContext);
  if (ctx === null) throw new Error('useTenant debe usarse dentro de TenantProvider');
  return ctx;
}
