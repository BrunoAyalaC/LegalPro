import { createContext, useContext, useState, useCallback, useMemo, useEffect, type ReactNode } from 'react';
import { api, clearTokens, getSessionFromCookie, setTokens, type SessionData } from '../api/client';
import { fixUtf8Mojibake } from '../utils/utf8';
import type { TenantContextType, TenantState, LoginResult, Usuario, Organizacion } from '../types';

const TenantContext = createContext<TenantContextType | null>(null);

/**
 * Construye Usuario/Organizacion EXCLUSIVAMENTE desde datos del servidor
 * (/api/auth/me o /api/auth/login). NUNCA decodifica JWT en cliente (atob).
 * SECURITY P0: evita exfiltración de claims y asegura claims frescos.
 */
function buildStateFromSession(session: SessionData | null): Pick<TenantState, 'usuario' | 'organizacion'> {
  if (!session) return { usuario: null, organizacion: null };

  const usuario: Usuario = {
    id: session.id ?? null,
    email: session.email ?? null,
    nombreCompleto: fixUtf8Mojibake(session.nombreCompleto ?? session.email ?? 'Usuario'),
    rol: session.rol ?? 'ABOGADO',
    especialidad: (session as any).especialidad ?? null,
  };

  const orgRaw = session.organizacion;
  const organizacion: Organizacion | null = orgRaw
    ? {
        id: orgRaw.id,
        nombre: fixUtf8Mojibake(orgRaw.nombre ?? 'Mi Firma Legal'),
        slug: orgRaw.slug ?? null,
        plan: orgRaw.plan ?? 'FREE',
        maxUsuarios: (orgRaw as any).usuarios_max ?? (orgRaw as any).maxUsuarios ?? 3,
        expedientesMax: (orgRaw as any).expedientes_max ?? (orgRaw as any).expedientesMax ?? 5,
        expedientesUsados: (orgRaw as any).expedientes_usados ?? (orgRaw as any).expedientesUsados ?? 0,
        usuariosUsados: (orgRaw as any).usuarios_usados ?? (orgRaw as any).usuariosUsados ?? 1,
        rolOrg: orgRaw.rolMiembro ?? null,
        isOrgAdmin: orgRaw.rolMiembro === 'ADMIN',
      }
    : null;

  return { usuario, organizacion };
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TenantState>({ token: null, usuario: null, organizacion: null });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Rehidratar sesión al montar — SOLO via httpOnly cookie → /api/auth/me ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await getSessionFromCookie();
        if (cancelled) return;
        if (session?.token) {
          const { usuario, organizacion } = buildStateFromSession(session);
          setState({ token: session.token, usuario, organizacion });
        } else {
          setState({ token: null, usuario: null, organizacion: null });
        }
      } catch {
        if (!cancelled) setState({ token: null, usuario: null, organizacion: null });
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string, remember = true): Promise<LoginResult> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.login({ email, password, remember });
      // Manejo MFA: si el backend pide segundo factor, no hay token aún
      if ((data as any).mfaRequired || (data as any).mfaSetupRequired) {
        return data as unknown as LoginResult;
      }
      const token = data.token;
      // Preferimos rehidratar desde /api/auth/me para obtener claims canónicos,
      // pero si el login ya trae organizacion/usuario, usamos eso como fallback
      let session: SessionData | null = null;
      try {
        session = await getSessionFromCookie();
      } catch {
        session = null;
      }
      if (session?.token) {
        const { usuario, organizacion } = buildStateFromSession(session);
        setState({ token: session.token, usuario, organizacion });
        return { token: session.token, usuario, organizacion };
      }
      // Fallback: construir desde payload de login sin decodificar JWT
      const usuarioFallback: Usuario = {
        id: (data.usuario as any)?.id ?? null,
        email: (data.usuario as any)?.email ?? email,
        nombreCompleto: fixUtf8Mojibake(
          (data.usuario as any)?.nombreCompleto ?? (data.usuario as any)?.nombre_completo ?? email,
        ),
        rol: (data.usuario as any)?.rol ?? 'ABOGADO',
        especialidad: null,
      };
      const orgFallback: Organizacion | null = data.organizacion
        ? {
            id: data.organizacion.id,
            nombre: fixUtf8Mojibake(data.organizacion.nombre),
            slug: data.organizacion.slug ?? null,
            plan: data.organizacion.plan ?? 'FREE',
            maxUsuarios: 3,
            expedientesMax: 5,
            expedientesUsados: 0,
            usuariosUsados: 1,
            rolOrg: data.organizacion.rolMiembro ?? null,
            isOrgAdmin: data.organizacion.rolMiembro === 'ADMIN',
          }
        : null;
      // Asegurar que el token en memoria esté seteado (api.login ya llamó setTokens)
      setTokens(token, (data as any).refreshToken ?? '');
      setState({ token, usuario: usuarioFallback, organizacion: orgFallback });
      return { token, usuario: usuarioFallback, organizacion: orgFallback };
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
   * Refresca el JWT llamando a /auth/me para obtener claims actualizados
   * (p.ej. después de crear o unirse a una organización).
   * La cookie HttpOnly se envía automáticamente con la petición.
   */
  const refreshToken = useCallback(async () => {
    try {
      const session = await getSessionFromCookie();
      if (session?.token) {
        const { usuario, organizacion } = buildStateFromSession(session);
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
