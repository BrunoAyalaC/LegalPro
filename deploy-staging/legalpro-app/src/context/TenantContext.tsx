import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { api, clearTokens, setTokens, getSessionFromCookie } from '../api/client';
import { fixUtf8Mojibake } from '../utils/utf8';
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
    nombreCompleto: fixUtf8Mojibake(payload.nombre_completo ?? payload.nombre ?? payload.email ?? 'Usuario'),
    rol: payload.rol ?? 'ABOGADO',
    especialidad: payload.especialidad ?? null,
  };

  const organizacion: Organizacion | null = payload.organization_id
    ? {
        id: payload.organization_id,
        nombre: fixUtf8Mojibake(payload.organization_name ?? 'Mi Firma Legal'),
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

export function TenantProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TenantState>({ token: null, usuario: null, organizacion: null });
  const [isLoading, setIsLoading] = useState(true); // empieza en true para verificar cookie al montar
  const [error, setError] = useState<string | null>(null);

  // ── Rehidratar sesión desde HttpOnly cookie al montar ────────────────────
  // La cookie la seteó el backend en /auth/login, /auth/register o /auth/me
  // y el navegador la envía automáticamente con withCredentials:true.
  // NO se usa localStorage — la cookie es HttpOnly, inaccesible desde JS.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await getSessionFromCookie();
        if (cancelled) return;
        if (session?.token) {
          const payload = parseJwt(session.token);
          const { usuario, organizacion } = buildStateFromPayload(payload);
          setState({ token: session.token, usuario, organizacion });
        }
      } catch {
        // No hay cookie o expiró — estado anónimo
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.login(email, password);
      const token = data.token;
      const payload = parseJwt(token);
      const { usuario, organizacion } = buildStateFromPayload(payload);
      // El backend ya seteó la cookie HttpOnly — solo actualizamos estado React
      // NO guardamos en localStorage (la cookie es el storage verdadero)
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

  const logout = useCallback(async () => {
    try {
      // El backend limpia la cookie HttpOnly
      await api.logout();
    } catch {
      // Aunque falle la llamada, limpiamos estado local
    } finally {
      clearTokens();
      setState({ token: null, usuario: null, organizacion: null });
      setError(null);
    }
  }, []);

  /**
   * Refresca el JWT llamando a /auth/me para obtener Claims actualizados
   * (p.ej. después de crear o unirse a una organización).
   * La cookie HttpOnly se envía automáticamente con la petición.
   */
  const refreshToken = useCallback(async () => {
    try {
      const session = await getSessionFromCookie();
      if (session?.token) {
        const payload = parseJwt(session.token);
        const { usuario, organizacion } = buildStateFromPayload(payload);
        // setTokens() ya fue llamado por getSessionFromCookie()
        setState({ token: session.token, usuario, organizacion });
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
