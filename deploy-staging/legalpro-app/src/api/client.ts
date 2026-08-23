// legalpro-app/src/api/client.ts
// Cliente API central con integracion real al backend (generado por @frontend)
// Multi-stack: Node (auth, orgs) + .NET (expedientes, IA) + Owner dashboard

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// ═══ Configuracion (Railway: Node + .NET + PostgreSQL — sin Supabase) ═══
const NODE_URL = (import.meta.env.VITE_NODE_API_URL || 'http://localhost:3001') as string;
const DOTNET_URL = (import.meta.env.VITE_DOTNET_API_URL || 'http://localhost:5000') as string;
const CORRELATION_HEADER = 'X-Correlation-Id';
const AUTH_HEADER = 'Authorization';

// ═══ Token storage (httpOnly cookie via backend, no localStorage) ═══
let ACCESS_TOKEN: string | null = null;
let REFRESH_TOKEN: string | null = null;

export function setTokens(access: string, refresh: string) {
  ACCESS_TOKEN = access;
  REFRESH_TOKEN = refresh;
}

export function clearTokens() {
  ACCESS_TOKEN = null;
  REFRESH_TOKEN = null;
}

export function getAccessToken() {
  return ACCESS_TOKEN;
}

// Alias para compatibilidad con import { getToken }
export const getToken = getAccessToken;

export function getRefreshToken() {
  return REFRESH_TOKEN;
}

// ═══ Correlation ID (genera uno si no existe) ═══
function getOrCreateCorrelationId(): string {
  const KEY = 'legalpro_correlation_id';
  let cid = sessionStorage.getItem(KEY);
  if (!cid) {
    cid = crypto.randomUUID();
    sessionStorage.setItem(KEY, cid);
  }
  return cid;
}

// ═══ Cliente Node (auth, organizaciones, ARCO) ═══
function createNodeClient(): AxiosInstance {
  const client = axios.create({
    baseURL: NODE_URL,
    timeout: 10000,
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' }
  });
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    config.headers.set(CORRELATION_HEADER, getOrCreateCorrelationId());
    if (ACCESS_TOKEN) config.headers.set(AUTH_HEADER, `Bearer ${ACCESS_TOKEN}`);
    return config;
  });
  client.interceptors.response.use(
    (r) => r,
    async (err: AxiosError) => {
      if (err.response?.status === 401 && REFRESH_TOKEN) {
        try {
          const res = await axios.post(`${NODE_URL}/api/auth/refresh`, { refreshToken: REFRESH_TOKEN });
          const newAccess = (res.data?.data?.accessToken) as string | undefined;
          const newRefresh = (res.data?.data?.refreshToken) as string | undefined;
          if (newAccess && newRefresh) {
            setTokens(newAccess, newRefresh);
            if (err.config) {
              err.config.headers.set(AUTH_HEADER, `Bearer ${newAccess}`);
              return client.request(err.config);
            }
          }
        } catch {
          clearTokens();
        }
      }
      return Promise.reject(err);
    }
  );
  return client;
}

// ═══ Cliente .NET (expedientes, IA, contadores) ═══
function createDotnetClient(): AxiosInstance {
  const client = axios.create({
    baseURL: DOTNET_URL,
    timeout: 30000, // IA puede ser lento
    withCredentials: true,
    headers: { 'Content-Type': 'application/json' }
  });
  client.interceptors.request.use((config: InternalAxiosRequestConfig) => {
    config.headers.set(CORRELATION_HEADER, getOrCreateCorrelationId());
    if (ACCESS_TOKEN) config.headers.set(AUTH_HEADER, `Bearer ${ACCESS_TOKEN}`);
    return config;
  });
  return client;
}

export const nodeClient = createNodeClient();
export const dotnetClient = createDotnetClient();

// ═══ Tipos ═══
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  correlationId?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface User {
  id: string;
  email: string;
  nombre_completo: string;
  rol: 'ABOGADO' | 'FISCAL' | 'JUEZ' | 'CONTADOR' | 'ADMIN';
  organization_id?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  usuario: {
    id: string;
    email: string;
    nombreCompleto: string;
    rol: string;
  };
  organizacion: {
    id: string;
    nombre: string;
    slug: string;
    plan: string;
    rolMiembro: string;
  } | null;
}

// ═══ Helpers ═══
export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const response = await nodeClient.post('/api/auth/login', payload);
  const data = response.data as LoginResponse & { error?: string };
  if (!data.token) throw new Error(data.error || 'Credenciales inválidas');
  setTokens(data.token, '');
  return data;
}

export async function getCurrentUser(): Promise<User> {
  const { data } = await nodeClient.get<ApiResponse<User>>('/api/auth/me');
  if (!data.success || !data.data) throw new Error(data.error || 'Failed');
  return data.data;
}

export async function logout() {
  try {
    await nodeClient.post('/api/auth/logout');
  } finally {
    clearTokens();
  }
}

/**
 * Rehidrata la sesión desde la HttpOnly cookie.
 * Se llama en el montaje inicial de TenantProvider para restaurar
 * la sesión sin depender de localStorage.
 * Devuelve el token + datos del usuario si la cookie es válida, o null.
 */
export interface SessionData {
  token: string;
  id: string | number;
  email: string;
  nombreCompleto: string;
  rol: string;
  especialidad?: string;
  estaActivo?: boolean;
  organizacion: {
    id: string | number;
    nombre: string;
    slug: string;
    plan: string;
    rolMiembro: string;
  } | null;
}
export async function getSessionFromCookie(): Promise<SessionData | null> {
  try {
    const response = await nodeClient.get('/api/auth/me');
    const d = response.data;
    if (d?.token) {
      setTokens(d.token, '');
      return d as SessionData;
    }
    return null;
  } catch {
    return null;
  }
}

export async function listarExpedientes(opts?: { page?: number; pageSize?: number; materia?: string; search?: string }): Promise<PaginatedResponse<any>> {
  const { data } = await dotnetClient.get<ApiResponse<PaginatedResponse<any>>>('/api/expedientes', { params: opts });
  if (!data.success || !data.data) throw new Error(data.error || 'Failed');
  return data.data;
}

export async function analizarExpediente(payload: { expedienteId: string; tipoAnalisis: string; rolUsuario?: string }): Promise<any> {
  const { data } = await dotnetClient.post<ApiResponse<any>>('/api/analista', payload);
  if (!data.success || !data.data) throw new Error(data.error || 'Failed');
  return data.data;
}

export async function buscarJurisprudencia(payload: { query: string; fuente?: string }): Promise<any> {
  const { data } = await dotnetClient.post<ApiResponse<any>>('/api/jurisprudencia/buscar', payload);
  if (!data.success || !data.data) throw new Error(data.error || 'Failed');
  return data.data;
}

export async function redactarEscrito(payload: { tipoEscrito: string; expedienteId?: string; hechos?: string; fundamentos?: string }): Promise<any> {
  const { data } = await dotnetClient.post<ApiResponse<any>>('/api/redactor/generar', payload);
  if (!data.success || !data.data) throw new Error(data.error || 'Failed');
  return data.data;
}

export async function predecirResultado(payload: { expedienteId: string; materia?: string }): Promise<any> {
  const { data } = await dotnetClient.post<ApiResponse<any>>('/api/predictor', payload);
  if (!data.success || !data.data) throw new Error(data.error || 'Failed');
  return data.data;
}

export async function exportarMisDatos(formato: 'json' | 'pdf' = 'json'): Promise<Blob> {
  const { data } = await nodeClient.get(`/api/mis-datos/export`, { params: { formato }, responseType: 'blob' });
  return data as Blob;
}

export async function getExpediente(id?: string | null) {
  if (!id) {
    const { data } = await nodeClient.get('/api/expedientes', { params: { page: 1, pageSize: 1 } });
    const items = data?.data ?? data?.expedientes ?? data;
    return Array.isArray(items) ? items[0] ?? null : items?.expedientes?.[0] ?? null;
  }
  const { data } = await nodeClient.get(`/api/expedientes/${id}`);
  return data;
}

export async function getDocumentos(expedienteId?: string | null) {
  if (!expedienteId) return [];
  const exp = await getExpediente(expedienteId);
  const docs = exp?.documentos;
  return Array.isArray(docs) ? docs : [];
}

export async function chat(
  mensaje: string,
  historial: Array<{ role: string; text: string }> = [],
  expedienteId?: string | null,
) {
  const { data } = await nodeClient.post('/api/ai/chat', {
    mensaje,
    historial,
    expediente_id: expedienteId ?? undefined,
    tipo: 'chat',
    disclaimerAceptado: true,
  });
  return data;
}

export async function getMisDatos() {
  const { data } = await nodeClient.get('/api/mis-datos');
  return data;
}

export async function updateMisDatos(payload: { nombreCompleto?: string; especialidad?: string }) {
  const { data } = await nodeClient.put('/api/mis-datos', payload);
  return data;
}

/** Respuesta compatible con Perfil.jsx (fetch-like). */
export async function exportMisDatos(): Promise<{
  ok: boolean;
  blob: () => Promise<Blob>;
  headers: { get: (name: string) => string | null };
}> {
  const res = await nodeClient.get('/api/mis-datos/export', {
    params: { formato: 'json' },
    responseType: 'blob',
    validateStatus: () => true,
  });
  const cd = res.headers['content-disposition'] as string | undefined;
  return {
    ok: res.status >= 200 && res.status < 300,
    blob: async () => res.data as Blob,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-disposition' ? cd ?? null : null) },
  };
}

export async function deleteAccount() {
  await nodeClient.post('/api/mis-datos/cancelar', { confirmacion: true });
}

// ═══ Named export `api` para compatibilidad con import { api } ═══
// Wrappers para compatibilidad de firmas:
//   - login(email, password): acepta dos strings en vez de payload objeto
//   - me(): alias para getCurrentUser
export const api = {
  login: (email: string, password: string) => login({ email, password }),
  logout,
  me: getCurrentUser,
  setTokens,
  clearTokens,
  getCurrentUser,
  getSessionFromCookie,
  listarExpedientes,
  analizarExpediente,
  buscarJurisprudencia,
  redactarEscrito,
  predecirResultado,
  exportarMisDatos,
  getExpediente,
  getDocumentos,
  chat,
  getMisDatos,
  updateMisDatos,
  exportMisDatos,
  deleteAccount,
  nodeClient,
  dotnetClient,
};

export default { nodeClient, dotnetClient, login, logout, getCurrentUser, setTokens, clearTokens, getSessionFromCookie, listarExpedientes, analizarExpediente, buscarJurisprudencia, redactarEscrito, predecirResultado, exportarMisDatos };
