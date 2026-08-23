// legalpro-app/src/api/client.ts
// Cliente API central con integracion real al backend (generado por @frontend)
// Multi-stack: Node (auth, orgs) + .NET (expedientes, IA) + Owner dashboard

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';

// ═══ Configuracion (Railway: Node + .NET + PostgreSQL — sin Supabase) ═══
const NODE_URL = (import.meta.env.VITE_NODE_API_URL || 'http://localhost:3001') as string;
const DOTNET_URL = (import.meta.env.VITE_DOTNET_API_URL || 'http://localhost:5000') as string;
const CORRELATION_HEADER = 'X-Correlation-Id';
const AUTH_HEADER = 'Authorization';

// ═══ Timeouts centralizados (NO hardcodear en componentes) ═══
//   - DEFAULT_TIMEOUT_MS → consultas rápidas (cliente base)
//   - IA_TIMEOUT_MS      → chat / consulta / detectar / redactar (40-80s en modelos free)
//   - OCR_TIMEOUT_MS     → upload con OCR multimodal (Qwen VL 70B, puede tardar 60-90s)
export const DEFAULT_TIMEOUT_MS = 10_000;
export const IA_TIMEOUT_MS = 90_000;
export const OCR_TIMEOUT_MS = 90_000;

// ═══ Modelo IA activo (single source of truth para el badge del header) ═══
// El frontend no decide el modelo — esto es solo etiqueta visible. El backend
// enruta al proveedor real según `OPENCODE_*` env vars. La constante permite
// cambiar el texto del badge sin tocar componentes.
export const IA_ACTIVE_PROVIDER_ID = 'opencode';
// Re-export de helpers del módulo iaProviders.js para que el consumidor no
// tenga que importar de dos sitios.
export { getProviderLabel, getActiveProviders, IA_PROVIDERS } from '../lib/iaProviders.js';

// ═══ Token storage — SECURITY P0 FIX 2026-08-21 ═══
// CUMPLIMIENTO: catalogs/security-policy.md — NUNCA persistir JWT/secrets en
// localStorage/sessionStorage (XSS exfiltrable). El backend setea httpOnly
// cookie (SameSite=Lax, Secure, path=/api) y el frontend mantiene SOLO
// referencia en memoria. F5 requiere revalidar vía /api/auth/me (cookie
// viajará con withCredentials:true). La variable en memoria NO sobrevive a
// refresh, pero la cookie sí — el boot rehidrata desde el servidor.
let ACCESS_TOKEN: string | null = null;
let REFRESH_TOKEN: string | null = null;

export function setTokens(access: string, refresh: string, _remember = false) {
  ACCESS_TOKEN = access || null;
  REFRESH_TOKEN = refresh || null;
  // NUNCA persistir en localStorage/sessionStorage — ver security-policy.md
  // _remember se ignora pero se mantiene por compatibilidad de firma
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

/**
 * @deprecated SECURITY P0 — Eliminado. No restaurar desde storage.
 * Se mantiene como no-op para compatibilidad (retorna null siempre).
 * El boot ahora depende exclusivamente de httpOnly cookie → /api/auth/me.
 */
export function restoreTokenFromStorage(): string | null {
  if (ACCESS_TOKEN) return ACCESS_TOKEN;
  return null;
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
    timeout: DEFAULT_TIMEOUT_MS,
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
    timeout: IA_TIMEOUT_MS, // IA puede ser lento
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
  /** @deprecated SECURITY P0 — ignorado. Sesión solo httpOnly cookie + memoria. */
  remember?: boolean;
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
  // ── Compatibilidad dual del contrato (auth-login-mfa.js) ──
  // Flags de flujo MFA: el backend los devuelve en LUGAR de token cuando se
  // requiere segundo factor (mfaRequired) o setup obligatorio (mfaSetupRequired).
  // Opcionales para no romper el login normal.
  mfaRequired?: boolean;
  mfaSetupRequired?: boolean;
  userId?: string;
  mfaMethods?: string[];
  accessToken?: string;
  refreshToken?: string;
}

// ═══ Helpers ═══
export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const response = await nodeClient.post('/api/auth/login', payload);
  const data = response.data as LoginResponse & { error?: string } & {
    data?: { mfaRequired?: boolean; mfaSetupRequired?: boolean };
  };
  // Compatibilidad dual: el backend (auth-login-mfa.js) marca el flujo MFA tanto a
  // nivel raíz como dentro de data. Cualquiera de los dos dispara el flujo MFA SIN
  // lanzar el error de "token faltante" — las credenciales ya fueron validadas y la
  // UI debe mostrar el paso de verificación/setup en lugar de un error falso.
  const mfaRequired = data.mfaRequired || data.data?.mfaRequired;
  const mfaSetupRequired = data.mfaSetupRequired || data.data?.mfaSetupRequired;
  if (mfaRequired || mfaSetupRequired) {
    return {
      ...data,
      mfaRequired: !!mfaRequired,
      mfaSetupRequired: !!mfaSetupRequired,
    } as LoginResponse;
  }
  if (!data.token) throw new Error(data.error || 'Credenciales inválidas');
  // SECURITY P0 FIX 2026-08-21: solo memoria + httpOnly cookie. NO localStorage.
  setTokens(data.token, data.refreshToken ?? '');
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
  // SECURITY P0 FIX 2026-08-21: rehidratación SOLO vía httpOnly cookie.
  // No se inspecciona storage. withCredentials envía la cookie automáticamente.
  // El interceptor adjunta Bearer si ACCESS_TOKEN ya está en memoria (post-login).
  // El backend puede refrescar el token en la cookie y devolverlo en el payload.
  try {
    const response = await nodeClient.get('/api/auth/me');
    const d = response.data as SessionData & { success?: boolean; data?: SessionData };
    // Shape dual: { token, ... } o { success, data: { token,... } }
    const session: SessionData | null = (d as any)?.token
      ? (d as SessionData)
      : (d as any)?.data?.token
        ? ((d as any).data as SessionData)
        : (d as any)?.success === false
          ? null
          : (d as SessionData);
    if (session?.token) {
      setTokens(session.token, '');
      return session;
    }
    // Si el endpoint devuelve shape { success, data } sin token suelto, pero data existe
    if ((d as any)?.data && typeof (d as any).data === 'object') {
      const maybe = (d as any).data as SessionData;
      if (maybe?.token) {
        setTokens(maybe.token, '');
        return maybe;
      }
    }
    return null;
  } catch {
    return null;
  }
}

export async function listarExpedientes(opts?: { page?: number; pageSize?: number; materia?: string; search?: string }, signal?: AbortSignal): Promise<PaginatedResponse<any>> {
  const { data } = await dotnetClient.get<ApiResponse<PaginatedResponse<any>>>('/api/expedientes', { params: opts, signal });
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

export async function getExpediente(id?: string | null, signal?: AbortSignal) {
  if (!id) {
    const { data } = await nodeClient.get('/api/expedientes', { params: { page: 1, pageSize: 1 }, signal });
    const items = data?.data ?? data?.expedientes ?? data;
    return Array.isArray(items) ? items[0] ?? null : items?.expedientes?.[0] ?? null;
  }
  const { data } = await nodeClient.get(`/api/expedientes/${id}`, { signal });
  return data;
}

export async function getDocumentos(expedienteId?: string | null, signal?: AbortSignal) {
  if (!expedienteId) return [];
  const exp = await getExpediente(expedienteId, signal);
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
  }, {
    timeout: IA_TIMEOUT_MS, // La IA DeepSeek free puede tardar 40-80s; no cortar a los 10s del cliente base
  });
  return data;
}

/**
 * Detecta el tipo de documento legal a partir de la conversación del chat.
 *
 * SIEMPRE envía `disclaimerAceptado: true`: el backend
 * (`server/routes/documento-chat.js` → `validarDisclaimerAceptado`) responde
 * 403 DISCLAIMER_REQUIRED si falta. Trazabilidad legal LPDP — misma
 * garantía que `chat()` en este mismo archivo.
 *
 * @param conversacion Historial del chat en formato [{ role, text }]
 * @param materia Materia del expediente vinculado (opcional)
 * @param expedienteId ID del expediente vinculado (opcional)
 */
export async function detectarDocumento(
  conversacion: Array<{ role: string; text: string }>,
  materia?: string,
  expedienteId?: string | null,
) {
  const { data } = await nodeClient.post('/api/ai/detectar-documento', {
    conversacion,
    materia,
    expediente_id: expedienteId ?? undefined,
    disclaimerAceptado: true,
  }, {
    timeout: IA_TIMEOUT_MS, // Detección IA puede tardar; no cortar a los 10s del cliente base
  });
  return data;
}

export interface RedactarDocumentoPayload {
  conversacion: Array<{ role: string; text: string }>;
  tipoDocumento: string;
  materia?: string;
  numeroExpediente?: string;
  juzgado?: string;
  recurrente?: string;
  abogado?: string;
  colegiatura?: string;
  organizacion?: string;
}

/**
 * Redacta un documento legal (PDF/DOCX) a partir de la conversación del chat.
 *
 * SIEMPRE envía `disclaimerAceptado: true`: el backend
 * (`server/routes/documento-chat.js` → `validarDisclaimerAceptado`) responde
 * 403 DISCLAIMER_REQUIRED si falta. Trazabilidad legal LPDP — misma
 * garantía que `chat()` en este mismo archivo.
 *
 * Devuelve la respuesta Axios completa (data = Blob + headers) para que el
 * llamador lea `content-disposition` y descargue el archivo. En error 4xx/5xx
 * axios deja `data` como Blob: el llamador debe revisar
 * `content-type: application/json` para leer el mensaje de error real.
 *
 * @param payload Datos de la redacción (conversación + tipo + metadatos membrete)
 * @param formato 'pdf' (por defecto) | 'docx'
 */
export async function redactarDocumento(
  payload: RedactarDocumentoPayload,
  formato: 'pdf' | 'docx' = 'pdf',
) {
  return nodeClient.post(
    '/api/ai/redactar-documento',
    {
      conversacion: payload.conversacion,
      tipo_documento: payload.tipoDocumento,
      materia: payload.materia,
      numero_expediente: payload.numeroExpediente,
      formato,
      juzgado: payload.juzgado,
      recurrente: payload.recurrente,
      abogado: payload.abogado,
      colegiatura: payload.colegiatura,
      organizacion: payload.organizacion,
      disclaimerAceptado: true,
    },
    { responseType: 'blob', timeout: IA_TIMEOUT_MS }
  );
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

/**
 * Ejerce el derecho de OPOSICIÓN al tratamiento de datos (LPDP Art. 27).
 *
 * DISTINTO de cancelar (que borra la cuenta). La oposición bloquea
 * finalidades ESPECÍFICAS de tratamiento sin eliminar los datos ni la cuenta.
 *
 * @param {('marketing'|'ia_automatizada'|'cesion_terceros'|'elaboracion_perfiles'|'tratamiento_estadistico'|'todos')} finalidad
 * @param {string} [motivo] motivo opcional declarado por el titular
 */
export type FinalidadOposicion =
  | 'marketing'
  | 'ia_automatizada'
  | 'cesion_terceros'
  | 'elaboracion_perfiles'
  | 'tratamiento_estadistico'
  | 'todos';

export async function oponerTratamiento(finalidad: FinalidadOposicion, motivo?: string) {
  const { data } = await nodeClient.post('/api/mis-datos/oposicion', { finalidad, motivo });
  return data as {
    success: boolean;
    mensaje: string;
    finalidad: FinalidadOposicion;
    fecha_registro: string;
    plazo_respuesta: string;
    nota: string;
  };
}

/**
 * Revoca un consentimiento LPDP específico del usuario autenticado.
 * LPDP Art. 14, 15: el consentimiento debe ser revocable en cualquier momento.
 *
 * Para `terminos` o `privacidad` el backend desactiva la cuenta por seguridad
 * y devuelve `cuenta_desactivada: true`.
 *
 * @param {('terminos'|'privacidad'|'marketing'|'transferencia_internacional')} tipo
 */
export type TipoConsentimiento =
  | 'terminos'
  | 'privacidad'
  | 'marketing'
  | 'transferencia_internacional';

export async function revocarConsentimiento(tipo: TipoConsentimiento) {
  const { data } = await nodeClient.delete(`/api/mis-datos/consentimiento/${tipo}`);
  return data as {
    success: boolean;
    mensaje: string;
    tipo?: string;
    fecha_revocacion?: string;
    cuenta_desactivada?: boolean;
  };
}

// ═══ Helper fantasma (compatibilidad con paginas IA del frontend) ═══
// Helper centralizado para las paginas IA del frontend (Redactor, Predictor, etc.).
//
// Routing por backend (verificado contra el código fuente):
//   - Tipos IA con gemelo Node POST /api/ai/consulta (server/routes/ai.js) →
//     nodeClient. Node acepta { prompt, tipo, disclaimerAceptado } y devuelve
//     `resultado` en el body (structured para predictor/analisis; texto libre
//     para redaccion/alegatos/interrogatorio).
//   - Jurisprudencia → nodeClient GET /api/ai/jurisprudencia?q= (devuelve
//     `resultados` como array estructurado — verificado 200 en prod).
//   - IA general (chat, casos_criticos, desconocido) → nodeClient POST /api/ai/chat.
//   - SOLO tipos SIN gemelo Node (objecion, simulacion, precedentes/comparador) →
//     dotnetClient. precedentes/comparador degradan a Node /consulta tipo
//     'general' si el .NET rechaza el contrato (400/404/500) para no dejar
//     ComparadorPrecedentes.jsx roto en producción.
//
// FIX 2026-08-07 (@auditor-performance): /api/ai/chat NO existe en .NET (solo
// `api/chat/enviar` y `api/ai/rag/*`). Antes todos los tipos caían a dotnetClient
// → 404 en producción. Ahora los tipos IA generales van por nodeClient con
// `mensaje` (el handler Node POST /api/ai/chat lee `mensaje`, NO `prompt`) y
// `disclaimerAceptado: true` (validarDisclaimerAceptado → 403 si falta).
//
// FIX 2026-08-07 (@auditor-performance): los tipos predictor/redaccion/
// jurisprudencia/alegatos/interrogatorio apuntaban a endpoints .NET
// (DOTNET_CONSULTA_ROUTES) cuyo CONTRATO CQRS es incompatible con el payload
// { prompt, tipo } → 400 en producción. Se migran a Node /api/ai/consulta que
// acepta { prompt, tipo, disclaimerAceptado } y devuelve `resultado`.
//
// El listado `TipoConsulta` ofrece autocompletado en el IDE sin perder
// flexibilidad para aceptar cualquier string arbitrario (`(string & {})`).

export type TipoConsulta =
  | 'redaccion'           // → node /api/ai/consulta (tipo redaccion)
  | 'predictor'           // → node /api/ai/consulta (tipo predictor)
  | 'jurisprudencia'      // → node GET /api/ai/jurisprudencia?q=
  | 'alegato' | 'alegatos' // → node /api/ai/consulta (tipo alegatos)
  | 'interrogatorio'      // → node /api/ai/consulta (tipo interrogatorio)
  | 'analisis'            // → node /api/ai/consulta (tipo analisis)
  | 'objecion'            // → dotnet /api/objeciones/sugerir (SIN gemelo Node)
  | 'simulacion'          // → dotnet /api/simulacion/iniciar (SIN gemelo Node)
  | 'precedentes' | 'comparador' // → dotnet /api/juez/precedentes/comparar (fallback node general)
  | 'casos_criticos'      // → node /api/ai/chat
  | 'casos-criticos'      // alias histórico (guion) → casos_criticos
  | 'general' | 'chat' | 'default' // → node /api/ai/chat (fallback)
  | (string & {}); // acepta cualquier string sin perder autocomplete

// Backend .NET: SOLO tipos IA SIN gemelo Node (verificado en
// LegalProBackend_Net/LegalPro.Api/Controllers). Los que tienen gemelo Node
// (predictor/redaccion/jurisprudencia/alegatos/interrogatorio/analisis) van por
// nodeClient — el contrato CQRS .NET rechaza el payload { prompt, tipo } → 400.
const DOTNET_CONSULTA_ROUTES: Record<string, string> = {
  // Sugerir objeciones
  objecion:       '/api/objeciones/sugerir',
  // Simulación de juicios
  simulacion:     '/api/simulacion/iniciar',
  // Juez: comparar precedentes (alias histórico usado por ComparadorPrecedentes.jsx)
  precedentes:    '/api/juez/precedentes/comparar',
  comparador:     '/api/juez/precedentes/comparar',
};

// Alias de tipo → clave canónica (convención snake_case)
const TIPO_ALIASES: Record<string, string> = {
  'casos-criticos': 'casos_criticos',
  'alegato': 'alegatos', // alias singular → tipo canónico Node POST /api/ai/consulta
};

// Backend Node: rutas IA (server/routes/ai.js)
const NODE_CHAT_ROUTE = '/api/ai/chat';
const NODE_CONSULTA_ROUTE = '/api/ai/consulta';
const NODE_JURISPRUDENCIA_ROUTE = '/api/ai/jurisprudencia';
const NODE_IA_TIMEOUT = IA_TIMEOUT_MS; // alias semántico (referencia el módulo)

// Tipos IA con gemelo en Node POST /api/ai/consulta (devuelven `resultado`)
const NODE_CONSULTA_TIPOS = new Set([
  'redaccion',
  'alegato',
  'alegatos',
  'interrogatorio',
  'analisis',
  'predictor',
]);

export async function consulta(
  prompt: string,
  tipo: TipoConsulta,
  extra: Record<string, any> = {},
) {
  const tipoNormalizado = TIPO_ALIASES[tipo] ?? tipo;

  // Jurisprudencia → Node GET /api/ai/jurisprudencia?q= (estructurado).
  // Devuelve { resultados: [...], query, rama, provider } — verificado 200 en prod.
  if (tipoNormalizado === 'jurisprudencia') {
    const { data } = await nodeClient.get(NODE_JURISPRUDENCIA_ROUTE, {
      params: { q: prompt, ...extra },
      timeout: NODE_IA_TIMEOUT,
    });
    return data;
  }

  // Tipos IA con gemelo Node POST /api/ai/consulta (server/routes/ai.js).
  // Node acepta { prompt, tipo, disclaimerAceptado } y devuelve `resultado`.
  if (NODE_CONSULTA_TIPOS.has(tipoNormalizado)) {
    const payload = { prompt, tipo: tipoNormalizado, disclaimerAceptado: true, ...extra };
    const { data } = await nodeClient.post(NODE_CONSULTA_ROUTE, payload, { timeout: NODE_IA_TIMEOUT });
    return data;
  }

  // Tipos SIN gemelo Node (objecion, simulacion, precedentes/comparador) → .NET.
  const urlDotnet = DOTNET_CONSULTA_ROUTES[tipoNormalizado];
  if (urlDotnet) {
    const payload = { prompt, tipo: tipoNormalizado, ...extra };
    try {
      const { data } = await dotnetClient.post(urlDotnet, payload);
      return data;
    } catch (err) {
      // FALLBACK OPENCODE-FIRST: el contrato CQRS .NET puede rechazar el payload
      // (400). precedentes/comparador degradan a Node /consulta tipo 'general'
      // para no dejar ComparadorPrecedentes.jsx roto en producción.
      if (tipoNormalizado === 'precedentes' || tipoNormalizado === 'comparador') {
        const fallbackPayload = { prompt, tipo: 'general', disclaimerAceptado: true, ...extra };
        const { data } = await nodeClient.post(NODE_CONSULTA_ROUTE, fallbackPayload, { timeout: NODE_IA_TIMEOUT });
        return data;
      }
      throw err;
    }
  }

  // IA general (general/chat/casos_criticos/desconocido) → Node /api/ai/chat.
  // El handler Node lee `mensaje` (NO `prompt`) y exige disclaimerAceptado: true.
  const payload = {
    mensaje: prompt,
    tipo: tipoNormalizado === 'general' ? 'general' : 'chat',
    ...extra,
    disclaimerAceptado: true,
  };
  const { data } = await nodeClient.post(NODE_CHAT_ROUTE, payload, { timeout: NODE_IA_TIMEOUT });
  return data;
}

export async function register(payload: { email: string; password: string; nombreCompleto: string; rol?: string; [key: string]: any }) {
  const { data } = await nodeClient.post('/api/auth/register', payload);
  return data;
}

export async function createDocumento(formData: FormData) {
  // axios detecta FormData y setea multipart/form-data con boundary automaticamente
  const { data } = await nodeClient.post('/api/documentos/upload', formData);
  return data;
}

/**
 * Sube un documento (imagen/PDF) para OCR multimodal (Qwen VL → texto_ocr).
 *
 * Endpoint backend: POST /api/documentos/upload (multipart/form-data).
 *   - Campos esperados por el backend: `file`, `expediente_id`, opcional
 *     `tipo_documento` y `descripcion`.
 *   - Requiere disclaimerAceptado LPDP (validado por authMiddleware + headers).
 *
 * El timeout es extendido a OCR_TIMEOUT_MS (90s) porque Qwen VL puede tardar
 * más de lo normal en imágenes grandes o PDFs multipágina. NO usar el timeout
 * default de 10s del cliente base — cortaría la subida justo cuando el modelo
 * está extrayendo texto.
 *
 * Devuelve la respuesta cruda de axios (`response.data`). Shape esperado:
 *   {
 *     success: true,
 *     mensaje: 'Documento procesado con OCR y registrado exitosamente.',
 *     documento: { id, hash_sha256, archivo_tamano, archivo_nombre, ... },
 *     textoOcr: string,
 *   }
 *
 * En errores comunes:
 *   - 402 INSUFFICIENT_CREDITS → no hay 2 créditos disponibles.
 *   - 404 → expediente no pertenece a la organización (RLS / tenant).
 *   - 503 IA_NO_DISPONIBLE → MINIMAX_API_KEY no configurada (fallback Qwen).
 *   - timeout (OCR_TIMEOUT_MS) → modelo lento; el llamador debe permitir reintentar.
 *
 * @param file             File (image/pdf) seleccionado por el usuario.
 * @param expedienteId     ID del expediente al que se asocia el documento.
 * @param opts             Opcionales: tipo_documento, descripcion, onUploadProgress.
 */
export async function uploadDocumento(
  file: File,
  expedienteId: string,
  opts?: {
    tipo_documento?: string;
    descripcion?: string;
    onUploadProgress?: (e: ProgressEvent) => void;
  },
) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('expediente_id', expedienteId);
  if (opts?.tipo_documento) formData.append('tipo_documento', opts.tipo_documento);
  if (opts?.descripcion) formData.append('descripcion', opts.descripcion);
  const { data } = await nodeClient.post('/api/documentos/upload', formData, {
    timeout: OCR_TIMEOUT_MS,
    onUploadProgress: opts?.onUploadProgress,
  });
  return data;
}

export async function analizar(expedienteId: string) {
  const { data } = await dotnetClient.post('/api/analista/analizar', { expedienteId });
  return data;
}

export async function createOrg(payload: { nombre: string; slug: string; plan: string; [key: string]: any }) {
  const { data } = await nodeClient.post('/api/organizaciones', payload);
  return data;
}

export async function acceptInvitation(token: string) {
  const { data } = await nodeClient.post('/api/organizaciones/aceptar-invitacion', { token });
  return data;
}

export async function getReporte(expedienteId: string, formato: 'json' | 'pdf' | 'docx' = 'json') {
  // Reporte consolidado del expediente: GET /api/expedientes/:id/reporte
  // (feature RICE @auditor-performance — exportación JSON/PDF/DOCX del caso).
  // Sin expedienteId (uso legacy de ReporteRetroalimentacion.jsx, que llama
  // sin argumento esperando otro shape) → fallback para no romper la página.
  if (!expedienteId) {
    return { mensaje: 'Funcionalidad en desarrollo', data: [] };
  }

  const params = { formato };

  // pdf/docx → blob binario para descarga (Content-Disposition del backend)
  if (formato === 'pdf' || formato === 'docx') {
    const { data } = await nodeClient.get(`/api/expedientes/${expedienteId}/reporte`, {
      params,
      responseType: 'blob',
    });
    return data as Blob;
  }

  const { data } = await nodeClient.get(`/api/expedientes/${expedienteId}/reporte`, { params });
  return data;
}

// ═══ Named export `api` para compatibilidad con import { api } ═══
// Wrappers para compatibilidad de firmas:
//   - login(email, password): acepta dos strings en vez de payload objeto
//   - me(): alias para getCurrentUser
export const api = {
  // Acepta ambas firmas: api.login('email','pass') (legacy) o
  // api.login({ email, password, remember }) (payload objeto con "Recordarme").
  login: (emailOrPayload: string | LoginPayload, password?: string) =>
    typeof emailOrPayload === 'string'
      ? login({ email: emailOrPayload, password: password ?? '' })
      : login(emailOrPayload),
  logout,
  me: getCurrentUser,
  setTokens,
  clearTokens,
  restoreTokenFromStorage,
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
  detectarDocumento,
  redactarDocumento,
  getMisDatos,
  updateMisDatos,
  exportMisDatos,
  deleteAccount,
  revocarConsentimiento,
  oponerTratamiento,
  consulta,
  register,
  createDocumento,
  uploadDocumento,
  analizar,
  createOrg,
  acceptInvitation,
  getReporte,
  nodeClient,
  dotnetClient,
  // Constantes expuestas (single source of truth para timeouts y modelo IA)
  DEFAULT_TIMEOUT_MS,
  IA_TIMEOUT_MS,
  OCR_TIMEOUT_MS,
  IA_ACTIVE_PROVIDER_ID,
};

export default { nodeClient, dotnetClient, login, logout, getCurrentUser, setTokens, clearTokens, getSessionFromCookie, listarExpedientes, analizarExpediente, buscarJurisprudencia, redactarEscrito, predecirResultado, exportarMisDatos };
