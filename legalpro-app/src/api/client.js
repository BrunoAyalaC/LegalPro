// En dev: usa proxy de Vite (/api → localhost)
// En producción (Railway): VITE_NODE_API_URL apunta al backend Node, VITE_DOTNET_API_URL al backend .NET
const NODE_API   = import.meta.env.VITE_NODE_API_URL   ?? '';
const DOTNET_API = import.meta.env.VITE_DOTNET_API_URL ?? '';

// Rutas que maneja .NET (expedientes, documentos — business logic)
const DOTNET_PREFIXES = ['/expedientes', '/documentos'];

function resolveBase(url) {
  return DOTNET_PREFIXES.some(p => url.startsWith(p)) ? `${DOTNET_API}/api` : `${NODE_API}/api`;
}

async function request(url, options = {}) {
  const token = localStorage.getItem('legalpro_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const base = resolveBase(url);
  const res = await fetch(`${base}${url}`, { ...options, headers });
  if (!res.ok) throw new Error(`Error ${res.status}`);
  return res.json();
}

export const api = {
  // Auth
  login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  me: () => request('/auth/me'),
  register: (data) => request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

  // Organizaciones
  createOrg: (data) => request('/organizaciones', { method: 'POST', body: JSON.stringify(data) }),
  getMyOrg: () => request('/organizaciones/me'),
  getMyOrgMembers: () => request('/organizaciones/me/miembros'),
  invitarMiembro: (email, rolInvitado = 'MEMBER') => request('/organizaciones/invitar', { method: 'POST', body: JSON.stringify({ email, rolInvitado }) }),
  acceptInvitation: (token) => request('/organizaciones/aceptar-invitacion', { method: 'POST', body: JSON.stringify({ token }) }),
  removeMember: (userId) => request(`/organizaciones/me/miembros/${userId}`, { method: 'DELETE' }),

  // Expedientes  
  getExpedientes: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/expedientes${qs ? '?' + qs : ''}`);
  },
  getExpediente: (id) => request(`/expedientes/${id}`),
  getStats: () => request('/expedientes/stats'),
  createExpediente: (data) => request('/expedientes', { method: 'POST', body: JSON.stringify(data) }),

  // Documentos
  getDocumentos: (expedienteId) => request(`/documentos?expediente_id=${expedienteId}`),
  createDocumento: (data) => request('/documentos', { method: 'POST', body: JSON.stringify(data) }),

  // Gemini AI
  chat: (mensaje, historial = [], expediente_id = null) => request('/gemini/chat', { method: 'POST', body: JSON.stringify({ mensaje, historial, expediente_id }) }),
  consulta: (prompt, tipo = 'general') => request('/gemini/consulta', { method: 'POST', body: JSON.stringify({ prompt, tipo }) }),
  getHistorial: () => request('/gemini/historial'),
  getNotificaciones: () => request('/gemini/notificaciones'),
  getJurisprudencia: (params = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/gemini/jurisprudencia${qs ? '?' + qs : ''}`);
  },
};

export default api;
