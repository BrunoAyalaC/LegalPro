/// <reference types="vite/client" />
// En dev: usa proxy de Vite (/api → localhost)
// En producción (Railway): VITE_NODE_API_URL apunta al backend Node, VITE_DOTNET_API_URL al backend .NET
const NODE_API: string = import.meta.env.VITE_NODE_API_URL   || 'https://legalpro-node-production-34ac.up.railway.app';
const DOTNET_API: string = import.meta.env.VITE_DOTNET_API_URL || 'https://legalpro-dotnet-production-5a39.up.railway.app';

// Rutas que maneja .NET (auth, expedientes, documentos, organizaciones — business logic)
const DOTNET_PREFIXES = ['/auth', '/expedientes', '/documentos', '/organizaciones'];

function resolveBase(url: string): string {
  return DOTNET_PREFIXES.some(p => url.startsWith(p)) ? `${DOTNET_API}/api` : `${NODE_API}/api`;
}

interface RequestOptions extends RequestInit {
  headers?: Record<string, string>;
}

async function request<T = unknown>(url: string, options: RequestOptions = {}): Promise<T> {
  const token = localStorage.getItem('legalpro_token');
  const headers: Record<string, string> = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const base = resolveBase(url);
  const res = await fetch(`${base}${url}`, { ...options, headers });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json() as Promise<T>;
}

export interface LoginResponse {
  token: string;
}

export interface MeResponse {
  token?: string;
}

export interface RegisterDataOld {
  email: string;
  password: string;
  nombre?: string;
}

export interface OrgData {
  nombre: string;
  slug?: string;
}

export interface ExpedienteParams {
  [key: string]: string | number | boolean | undefined;
}

export interface DocumentoData {
  titulo: string;
  contenido?: string;
  expediente_id?: string | number;
}

export interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

export interface ChatData {
  mensaje: string;
  historial?: ChatMessage[];
  expediente_id?: string | number | null;
}

export interface ConsultaData {
  prompt: string;
  tipo?: string;
}

export interface RegisterData {
  email: string;
  password: string;
  nombreCompleto: string;
  rol?: string;
  especialidad?: string;
  aceptaTerminos: boolean;
  aceptaPrivacidad: boolean;
}

export interface MisDatosResponse {
  usuario: {
    id: string;
    nombreCompleto: string;
    email: string;
    rol: string;
    especialidad: string | null;
    estaActivo: boolean;
    terminosAceptadosEn: string | null;
    terminosVersion: string | null;
    privacidadAceptadaEn: string | null;
    privacidadVersion: string | null;
    creadoEn: string;
    actualizadoEn: string | null;
  };
  organizacion: unknown;
  consentimientos: unknown[];
  estadisticasUso: unknown;
}

export const api = {
  // Auth
  login: (email: string, password: string) => request<LoginResponse>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request<MeResponse>('/auth/me'),
  register: (data: RegisterData) => request<unknown>('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
  deleteCuenta: () => request<unknown>('/auth/cuenta', { method: 'DELETE' }),

  // Mis Datos (Derechos ARCO)
  getMisDatos: () => request<MisDatosResponse>('/mis-datos'),
  updateMisDatos: (data: { nombreCompleto?: string; especialidad?: string }) => request<unknown>('/mis-datos', { method: 'PUT', body: JSON.stringify(data) }),
  exportMisDatos: () => fetch(`${resolveBase('/mis-datos')}/mis-datos/export`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('legalpro_token') ?? ''}` },
  }),

  // Organizaciones
  createOrg: (data: OrgData) => request<unknown>('/organizaciones', { method: 'POST', body: JSON.stringify(data) }),
  getMyOrg: () => request<unknown>('/organizaciones/me'),
  getMyOrgMembers: () => request<unknown[]>('/organizaciones/me/miembros'),
  invitarMiembro: (email: string, rolInvitado = 'MEMBER') => request<unknown>('/organizaciones/invitar', { method: 'POST', body: JSON.stringify({ email, rolInvitado }) }),
  acceptInvitation: (token: string) => request<unknown>('/organizaciones/aceptar-invitacion', { method: 'POST', body: JSON.stringify({ token }) }),
  removeMember: (userId: string | number) => request<unknown>(`/organizaciones/me/miembros/${userId}`, { method: 'DELETE' }),

  // Expedientes  
  getExpedientes: (params: ExpedienteParams = {}) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<unknown[]>(`/expedientes${qs ? '?' + qs : ''}`);
  },
  getExpediente: (id: string | number) => request<unknown>(`/expedientes/${id}`),
  getStats: () => request<unknown>('/expedientes/stats'),
  createExpediente: (data: unknown) => request<unknown>('/expedientes', { method: 'POST', body: JSON.stringify(data) }),

  // Documentos
  getDocumentos: (expedienteId: string | number) => request<unknown[]>(`/documentos?expediente_id=${expedienteId}`),
  createDocumento: (data: DocumentoData) => request<unknown>('/documentos', { method: 'POST', body: JSON.stringify(data) }),

  // Gemini AI — disclaimerAceptado: true requerido por normativa peruana (LPDP + principios éticos IA)
  chat: (mensaje: string, historial: ChatMessage[] = [], expediente_id: string | number | null = null) => request<unknown>('/gemini/chat', { method: 'POST', body: JSON.stringify({ mensaje, historial, expediente_id, disclaimerAceptado: true }) }),
  consulta: (prompt: string, tipo = 'general') => request<unknown>('/gemini/consulta', { method: 'POST', body: JSON.stringify({ prompt, tipo, disclaimerAceptado: true }) }),
  getHistorial: () => request<unknown[]>('/gemini/historial'),
  getNotificaciones: () => request<unknown[]>('/gemini/notificaciones'),
  getJurisprudencia: (params: ExpedienteParams = {}) => {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request<unknown[]>(`/gemini/jurisprudencia${qs ? '?' + qs : ''}`);
  },
};

export default api;
