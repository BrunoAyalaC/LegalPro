/* =============================================================================
   LegalPro Owner Dashboard — Lógica del Frontend (conectada a owner-dashboard.html + server.js)
   ============================================================================= */

/* ── Estado ──────────────────────────────────── */
let ownerToken = sessionStorage.getItem('owner_token') || '';
let chartInstance = null;
let currentCurrency = 'USD';
let applyTax = false;
let lastKpisData = null;
let currentTenantIdForPlan = null;
let currentTenantIdForRefund = null;

/* ── Refs del DOM (IDs del owner-dashboard.html) ── */
const loginView = document.getElementById('login-view');
const dashboardView = document.getElementById('dashboard-view');
const ownerKeyInput = document.getElementById('owner-key');
const decryptPhraseInput = document.getElementById('decrypt-phrase');
const loginBtn = document.getElementById('login-btn');
const loginError = document.getElementById('login-error');
const kpiGrid = document.getElementById('kpi-grid');
const tenantsTbody = document.getElementById('tenants-tbody');
const chartContainer = document.getElementById('chart-30d');
const canvas30d = document.getElementById('canvas-30d');
const modeloUso = document.getElementById('modelo-uso');
const auditTbody = document.getElementById('audit-tbody');
const btnRefresh = document.getElementById('btn-refresh');
const btnLogout = document.getElementById('btn-logout');
const lastUpdateText = document.getElementById('last-update-text');

/* ── Modals ── */
const modalCP = document.getElementById('modal-change-plan');
const modalCPName = document.getElementById('modal-cp-tenant-name');
const modalCPPlan = document.getElementById('modal-cp-plan');
const modalCPMaxUsers = document.getElementById('modal-cp-max-users');
const modalCPMaxExp = document.getElementById('modal-cp-max-exp');
const modalCPMaxIa = document.getElementById('modal-cp-max-ia');
const modalCPError = document.getElementById('modal-cp-error');
const modalCPCancel = document.getElementById('modal-cp-cancel');
const modalCPConfirm = document.getElementById('modal-cp-confirm');

const modalRef = document.getElementById('modal-refund');
const modalRefName = document.getElementById('modal-ref-tenant-name');
const modalRefMonto = document.getElementById('modal-ref-monto');
const modalRefMotivo = document.getElementById('modal-ref-motivo');
const modalRefError = document.getElementById('modal-ref-error');
const modalRefCancel = document.getElementById('modal-ref-cancel');
const modalRefConfirm = document.getElementById('modal-ref-confirm');

/* ── Helpers ── */
function formatPriceDirect(val) {
  const v = parseFloat(val) || 0;
  if (currentCurrency === 'USD') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency', currency: 'USD',
      minimumFractionDigits: 2, maximumFractionDigits: 6
    }).format(v);
  }
  return new Intl.NumberFormat('es-PE', {
    style: 'currency', currency: 'PEN',
    minimumFractionDigits: 2, maximumFractionDigits: 4
  }).format(v);
}

function formatPrice(valUsd) {
  let val = parseFloat(valUsd) || 0;
  if (currentCurrency === 'PEN') val *= 3.75;
  if (applyTax) val *= 1.18;
  return formatPriceDirect(val);
}

function formatNumber(val) {
  return new Intl.NumberFormat('es-PE').format(parseInt(val) || 0);
}

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  if (str == null) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/* ── Vistas ── */
function showDashboard() {
  loginView.classList.add('hidden');
  dashboardView.classList.remove('hidden');
}

function showLogin() {
  dashboardView.classList.add('hidden');
  loginView.classList.remove('hidden');
}

/* ── Login ── */
loginBtn.addEventListener('click', async () => {
  const keyVal = ownerKeyInput.value.trim();
  const phraseVal = decryptPhraseInput.value.trim();
  if (!keyVal || !phraseVal) {
    loginError.textContent = 'Ambos campos son obligatorios.';
    return;
  }
  loginBtn.disabled = true;
  loginBtn.textContent = 'Autenticando...';
  loginError.textContent = '';

  try {
    const res = await fetch('/api/owner/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerKey: keyVal, decryptPhrase: phraseVal })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Credenciales inválidas.');

    ownerToken = json.token;
    sessionStorage.setItem('owner_token', ownerToken);
    sessionStorage.setItem('owner_phrase', phraseVal); // guardar para E2EE
    showDashboard();
    ownerKeyInput.value = '';
    decryptPhraseInput.value = '';
    await loadAllData();
  } catch (err) {
    loginError.textContent = err.message || 'Error de autenticación.';
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Ingresar';
  }
});

/* ── Logout ── */
btnLogout.addEventListener('click', () => {
  sessionStorage.removeItem('owner_token');
  ownerToken = '';
  lastKpisData = null;
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  showLogin();
});

/* ── Refresh ── */
btnRefresh.addEventListener('click', loadAllData);

/* ── Web Crypto API: descifrado E2EE (AES-256-GCM + PBKDF2) ── */
async function decryptWithWebCrypto(encryptedPayload, phrase) {
  const { ciphertext, iv, tag, salt } = encryptedPayload;
  if (!ciphertext || !iv || !tag || !salt) throw new Error('Payload E2EE incompleto');

  // Importar la frase como clave PBKDF2
  const enc = new TextEncoder();
  const phraseKey = await crypto.subtle.importKey(
    'raw', enc.encode(phrase), 'PBKDF2', false, ['deriveKey']
  );

  // Derivar clave AES-256 con PBKDF2 (100k iteraciones)
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: new Uint8Array(salt.match(/.{1,2}/g).map(b => parseInt(b, 16))),
      iterations: 100000,
      hash: 'SHA-256',
    },
    phraseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  // Descifrar AES-256-GCM
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(iv.match(/.{1,2}/g).map(b => parseInt(b, 16))),
      additionalData: new Uint8Array(tag.match(/.{1,2}/g).map(b => parseInt(b, 16))),
    },
    aesKey,
    new Uint8Array(ciphertext.match(/.{1,2}/g).map(b => parseInt(b, 16)))
  );

  return JSON.parse(new TextDecoder().decode(decrypted));
}

/* ── Cargar datos ── */
async function apiFetch(url, options) {
  const phrase = sessionStorage.getItem('owner_phrase');
  const res = await fetch(url, {
    ...options,
    headers: {
      ...(options?.headers || {}),
      'Authorization': `Bearer ${ownerToken}`,
      'Content-Type': 'application/json',
      ...(phrase ? { 'x-decrypt-phrase': phrase } : {}),
    }
  });
  const json = await res.json();
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      sessionStorage.removeItem('owner_token');
      sessionStorage.removeItem('owner_phrase');
      ownerToken = '';
      showLogin();
      throw new Error('Sesión expirada. Vuelva a iniciar sesión.');
    }
    throw new Error(json.error || `Error HTTP ${res.status}`);
  }
  // Descifrar E2EE si el servidor respondió cifrado
  if (json.e2ee && json.data && phrase) {
    try {
      const decrypted = await decryptWithWebCrypto(json.data, phrase);
      return decrypted;
    } catch (e) {
      console.error('[E2EE] Error de descifrado:', e);
      throw new Error('Error al descifrar datos. Verifique su frase de descifrado.');
    }
  }
  return json;
}

async function loadAllData() {
  try {
    const [statsRes, tenantsRes, auditRes] = await Promise.all([
      apiFetch('/api/owner/stats'),
      apiFetch('/api/owner/tenants?limit=100'),
      apiFetch('/api/owner/audit-log?limit=50')
    ]);

    const data = statsRes.data || statsRes;
    const tenants = tenantsRes.data || tenantsRes;
    const auditLog = auditRes.data || auditRes;

    lastKpisData = data.kpis;

    renderKPIs(data.kpis);
    renderTenants(tenants);
    renderChart(data.consumoDiario);
    renderModels(data.consumoModelos);
    renderAuditLog(auditLog);

    const now = new Date();
    lastUpdateText.textContent =
      `Actualizado: ${now.toLocaleDateString('es-PE')} a las ${now.toLocaleTimeString('es-PE')}`;
  } catch (err) {
    console.error('loadAllData error:', err);
    alert(err.message || 'Error al cargar datos.');
  }
}

/* ── Render KPIs ── */
function renderKPIs(kpis) {
  if (!kpis) return;
  const totalCosto = parseFloat(kpis.total_costo) || 0;
  const totalReq = parseInt(kpis.total_requests) || 0;
  const costoMes = parseFloat(kpis.costo_mes) || 0;
  const tokensMes = parseInt(kpis.tokens_mes) || 0;
  const promTokens = totalReq > 0 ? Math.round(tokensMes / totalReq) : 0;

  kpiGrid.innerHTML = `
    <div class="kpi">
      <div class="kpi-label">💰 Costo Total Histórico</div>
      <div class="kpi-value">${formatPrice(totalCosto)}</div>
      <div class="kpi-trend">${formatNumber(totalReq)} peticiones registradas</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">📅 Presupuesto del Mes</div>
      <div class="kpi-value">${formatPrice(costoMes)}</div>
      <div class="kpi-trend">${formatNumber(tokensMes)} tokens este mes</div>
    </div>
    <div class="kpi">
      <div class="kpi-label">⚡ Tokens Totales del Mes</div>
      <div class="kpi-value">${formatNumber(tokensMes)}</div>
      <div class="kpi-trend">Promedio ~${formatNumber(promTokens)} tokens/petición</div>
    </div>
  `;
}

/* ── Render Tenants ── */
function renderTenants(tenants) {
  if (!tenants || tenants.length === 0) {
    tenantsTbody.innerHTML = '<tr><td colspan="7" class="loading-text">No hay tenants registrados.</td></tr>';
    return;
  }

  tenantsTbody.innerHTML = '';
  tenants.forEach(t => {
    const tr = document.createElement('tr');
    const estadoClass = t.activo ? 'badge-active' : 'badge-suspended';
    const estadoText = t.activo ? 'Activo' : 'Suspendido';
    const planClass = 'badge ' + (t.plan || 'free').toLowerCase();

    tr.innerHTML = `
      <td><strong>${escapeHtml(t.nombre)}</strong></td>
      <td><span class="${planClass}">${escapeHtml(t.plan || 'free')}</span></td>
      <td><span class="${estadoClass}" style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;">${estadoText}</span></td>
      <td class="mono">${formatNumber(t.max_usuarios)}</td>
      <td class="mono">${formatNumber(t.max_expedientes)}</td>
      <td class="mono">${formatNumber(t.max_consultas_ia_mes)}</td>
      <td>
        <div style="display:flex;gap:4px;flex-wrap:wrap;">
          ${t.activo
            ? `<button class="btn btn-sm btn-danger btn-suspend" data-id="${t.id}" data-name="${escapeHtml(t.nombre)}">Suspender</button>`
            : `<button class="btn btn-sm btn-success btn-reactivate" data-id="${t.id}" data-name="${escapeHtml(t.nombre)}">Reactivar</button>`
          }
          <button class="btn btn-sm btn-warning btn-change-plan" data-id="${t.id}" data-name="${escapeHtml(t.nombre)}"
            data-plan="${t.plan}" data-max-users="${t.max_usuarios}" data-max-exp="${t.max_expedientes}" data-max-ia="${t.max_consultas_ia_mes}">Plan</button>
          <button class="btn btn-sm btn-refund btn-refund-action" data-id="${t.id}" data-name="${escapeHtml(t.nombre)}">Reembolso</button>
        </div>
      </td>
    `;
    tenantsTbody.appendChild(tr);
  });

  // Attach event listeners for tenant actions
  tenantsTbody.querySelectorAll('.btn-suspend').forEach(btn => {
    btn.addEventListener('click', () => suspendTenant(btn.dataset.id, btn.dataset.name));
  });
  tenantsTbody.querySelectorAll('.btn-reactivate').forEach(btn => {
    btn.addEventListener('click', () => reactivateTenant(btn.dataset.id, btn.dataset.name));
  });
  tenantsTbody.querySelectorAll('.btn-change-plan').forEach(btn => {
    btn.addEventListener('click', () => openChangePlanModal(btn.dataset));
  });
  tenantsTbody.querySelectorAll('.btn-refund-action').forEach(btn => {
    btn.addEventListener('click', () => openRefundModal(btn.dataset.id, btn.dataset.name));
  });
}

/* ── Render Chart ── */
function renderChart(consumoDiario) {
  const ctx = canvas30d.getContext('2d');
  if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

  const entries = consumoDiario || [];
  if (entries.length === 0) {
    // show empty state on canvas
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: { labels: ['Sin datos'], datasets: [{ label: 'Gasto Diario', data: [0], backgroundColor: 'rgba(148,163,184,0.3)' }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
    });
    return;
  }

  const fechas = entries.map(d => {
    const partes = (d.fecha || '').split('-');
    if (partes.length < 3) return d.fecha || '—';
    const dateObj = new Date(partes[0], partes[1] - 1, partes[2]);
    return dateObj.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' });
  });

  const costos = entries.map(d => {
    let val = parseFloat(d.costo) || 0;
    if (currentCurrency === 'PEN') val *= 3.75;
    if (applyTax) val *= 1.18;
    return val;
  });

  const tokens = entries.map(d => parseInt(d.tokens) || 0);

  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: fechas,
      datasets: [
        {
          label: `Gasto Diario (${currentCurrency})${applyTax ? ' + IGV' : ''}`,
          data: costos,
          type: 'line',
          borderColor: '#06b6d4',
          borderWidth: 3,
          pointBackgroundColor: '#06b6d4',
          pointBorderColor: '#fff',
          pointHoverRadius: 6,
          yAxisID: 'y-costo',
          fill: false,
          tension: 0.35
        },
        {
          label: 'Tokens Generados',
          data: tokens,
          backgroundColor: 'rgba(168, 85, 247, 0.25)',
          borderColor: 'rgba(168, 85, 247, 0.6)',
          borderWidth: 1.5,
          borderRadius: 6,
          yAxisID: 'y-tokens'
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { labels: { color: '#94a3b8', font: { size: 12 } } },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(13, 11, 23, 0.9)',
          borderColor: 'rgba(168, 85, 247, 0.3)',
          borderWidth: 1,
          titleFont: { size: 13, weight: 'bold' },
          bodyFont: { size: 12 },
          bodyColor: '#e2e8f0',
          callbacks: {
            label: function(context) {
              let label = context.dataset.label || '';
              if (label) label += ': ';
              if (context.datasetIndex === 0) label += formatPriceDirect(context.parsed.y);
              else label += formatNumber(context.parsed.y);
              return label;
            }
          }
        }
      },
      scales: {
        x: { grid: { color: 'rgba(255,255,255,0.03)' }, ticks: { color: '#94a3b8', font: { size: 11 } } },
        'y-costo': {
          type: 'linear', position: 'left',
          grid: { color: 'rgba(255,255,255,0.05)' },
          ticks: { color: '#06b6d4', font: { size: 11 }, callback: v => (currentCurrency === 'USD' ? '$' : 'S/.') + v.toFixed(3) },
          title: { display: true, text: `Costo (${currentCurrency})${applyTax ? ' + IGV' : ''}`, color: '#06b6d4', font: { size: 12, weight: 'bold' } }
        },
        'y-tokens': {
          type: 'linear', position: 'right',
          grid: { drawOnChartArea: false },
          ticks: { color: '#a855f7', font: { size: 11 }, callback: function(v) { if (v >= 1e6) return (v/1e6).toFixed(1)+'M'; if (v >= 1e3) return (v/1e3).toFixed(0)+'k'; return v; } },
          title: { display: true, text: 'Tokens', color: '#a855f7', font: { size: 12, weight: 'bold' } }
        }
      }
    }
  });
}

/* ── Render Modelos ── */
function renderModels(modelos) {
  if (!modelos || modelos.length === 0) {
    modeloUso.innerHTML = '<p class="loading-text">No hay consumo de modelos registrado.</p>';
    return;
  }
  modeloUso.innerHTML = '';
  modelos.forEach(m => {
    const card = document.createElement('div');
    card.className = 'modelo-card';
    card.innerHTML = `
      <div>
        <div class="name">${escapeHtml(m.modelo)}</div>
        <div class="stats">${formatNumber(m.requests)} peticiones · ${formatNumber(m.prompt_tokens || 0)} prompt · ${formatNumber(m.completion_tokens || 0)} completion</div>
      </div>
      <div class="cost">${formatPrice(m.costo)}</div>
    `;
    modeloUso.appendChild(card);
  });
}

/* ── Render Audit Log ── */
function renderAuditLog(logs) {
  if (!logs || logs.length === 0) {
    auditTbody.innerHTML = '<tr><td colspan="5" class="loading-text">No hay eventos de auditoría.</td></tr>';
    return;
  }
  auditTbody.innerHTML = '';
  logs.forEach(log => {
    const tr = document.createElement('tr');
    const sevClass = log.severity === 'CRITICAL' ? 'badge-suspended' :
                     log.severity === 'HIGH' ? 'badge' :
                     '';
    let payloadStr = '';
    try {
      const p = typeof log.payload_masked === 'string' ? JSON.parse(log.payload_masked) : log.payload_masked;
      payloadStr = Object.entries(p || {}).map(([k, v]) => `${k}=${v}`).join(', ');
    } catch { payloadStr = String(log.payload_masked || ''); }
    if (payloadStr.length > 60) payloadStr = payloadStr.slice(0, 60) + '...';

    tr.innerHTML = `
      <td class="mono" style="font-size:12px;">${escapeHtml(formatDate(log.created_at))}</td>
      <td><code style="background:rgba(255,255,255,0.05);padding:2px 6px;border-radius:4px;font-size:12px;">${escapeHtml(log.event_name)}</code></td>
      <td><span style="display:inline-block;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;${log.severity === 'CRITICAL' ? 'background:rgba(239,68,68,0.2);color:#ef4444;' : ''}${log.severity === 'HIGH' ? 'background:rgba(245,158,11,0.2);color:#f59e0b;' : ''}">${escapeHtml(log.severity)}</span></td>
      <td class="mono" style="font-size:12px;">${escapeHtml(log.ip_address || '—')}</td>
      <td style="font-size:12px;color:var(--muted);">${escapeHtml(payloadStr || '—')}</td>
    `;
    auditTbody.appendChild(tr);
  });
}

/* ── Mutaciones: Suspend ── */
async function suspendTenant(id, name) {
  const motivo = prompt(`Motivo para SUSPENDER a "${name}":`, 'Incumplimiento de términos');
  if (!motivo) return;
  try {
    const res = await apiFetch(`/api/owner/tenants/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ motivo })
    });
    if (res.success) {
      alert(`Tenant "${name}" suspendido correctamente.`);
      await loadAllData();
    } else {
      alert('Error: ' + (res.error || 'No se pudo suspender.'));
    }
  } catch (err) {
    alert('Error al suspender: ' + err.message);
  }
}

/* ── Mutaciones: Reactivate ── */
async function reactivateTenant(id, name) {
  if (!confirm(`¿Reactivar a "${name}"?`)) return;
  try {
    const res = await apiFetch(`/api/owner/tenants/${id}/reactivate`, { method: 'POST' });
    if (res.success) {
      alert(`Tenant "${name}" reactivado correctamente.`);
      await loadAllData();
    } else {
      alert('Error: ' + (res.error || 'No se pudo reactivar.'));
    }
  } catch (err) {
    alert('Error al reactivar: ' + err.message);
  }
}

/* ── Mutaciones: Change Plan (modal) ── */
function openChangePlanModal(dataset) {
  currentTenantIdForPlan = dataset.id;
  modalCPName.textContent = `Cambiando plan de: ${dataset.name}`;
  modalCPPlan.value = dataset.plan || 'free';
  modalCPMaxUsers.value = dataset.maxUsers || '';
  modalCPMaxExp.value = dataset.maxExp || '';
  modalCPMaxIa.value = dataset.maxIa || '';
  modalCPError.textContent = '';
  modalCP.classList.remove('hidden');
}

modalCPCancel.addEventListener('click', () => {
  modalCP.classList.add('hidden');
  currentTenantIdForPlan = null;
});

modalCPConfirm.addEventListener('click', async () => {
  const plan = modalCPPlan.value;
  const max_usuarios = parseInt(modalCPMaxUsers.value) || undefined;
  const max_expedientes = parseInt(modalCPMaxExp.value) || undefined;
  const max_consultas_ia_mes = parseInt(modalCPMaxIa.value) || undefined;

  if (!currentTenantIdForPlan) return;

  modalCPConfirm.disabled = true;
  modalCPConfirm.textContent = 'Guardando...';
  try {
    const res = await apiFetch(`/api/owner/tenants/${currentTenantIdForPlan}/plan`, {
      method: 'PUT',
      body: JSON.stringify({ plan, max_usuarios, max_expedientes, max_consultas_ia_mes })
    });
    if (res.success) {
      alert('Plan actualizado correctamente.');
      modalCP.classList.add('hidden');
      currentTenantIdForPlan = null;
      await loadAllData();
    } else {
      modalCPError.textContent = res.error || 'Error al actualizar plan.';
    }
  } catch (err) {
    modalCPError.textContent = err.message || 'Error de conexión.';
  } finally {
    modalCPConfirm.disabled = false;
    modalCPConfirm.textContent = 'Guardar Cambios';
  }
});

/* ── Mutaciones: Refund (modal) ── */
function openRefundModal(id, name) {
  currentTenantIdForRefund = id;
  modalRefName.textContent = `Reembolso para: ${name}`;
  modalRefMonto.value = '';
  modalRefMotivo.value = '';
  modalRefError.textContent = '';
  modalRef.classList.remove('hidden');
}

modalRefCancel.addEventListener('click', () => {
  modalRef.classList.add('hidden');
  currentTenantIdForRefund = null;
});

modalRefConfirm.addEventListener('click', async () => {
  const monto = parseFloat(modalRefMonto.value);
  const motivo = modalRefMotivo.value.trim();
  if (!monto || monto <= 0) { modalRefError.textContent = 'Ingrese un monto válido.'; return; }
  if (!motivo) { modalRefError.textContent = 'Ingrese un motivo.'; return; }
  if (!currentTenantIdForRefund) return;

  modalRefConfirm.disabled = true;
  modalRefConfirm.textContent = 'Procesando...';
  try {
    const res = await apiFetch('/api/owner/refund', {
      method: 'POST',
      body: JSON.stringify({ tenantId: currentTenantIdForRefund, monto, motivo })
    });
    if (res.success) {
      alert(`Reembolso de $${monto} procesado correctamente.`);
      modalRef.classList.add('hidden');
      currentTenantIdForRefund = null;
      await loadAllData();
    } else {
      modalRefError.textContent = res.error || 'Error al procesar reembolso.';
    }
  } catch (err) {
    modalRefError.textContent = err.message || 'Error de conexión.';
  } finally {
    modalRefConfirm.disabled = false;
    modalRefConfirm.textContent = 'Confirmar Reembolso';
  }
});

/* ── Inicialización ── */
document.addEventListener('DOMContentLoaded', () => {
  if (ownerToken) {
    showDashboard();
    loadAllData();
  }

  // Currency selector
  const currencySelect = document.getElementById('currency-select');
  const taxCheckbox = document.getElementById('tax-checkbox');

  if (currencySelect) {
    currencySelect.addEventListener('change', (e) => {
      currentCurrency = e.target.value;
      reRenderCurrent();
    });
  }
  if (taxCheckbox) {
    taxCheckbox.addEventListener('change', (e) => {
      applyTax = e.target.checked;
      reRenderCurrent();
    });
  }
});

function reRenderCurrent() {
  if (lastKpisData) renderKPIs(lastKpisData);
  // The chart is re-rendered via loadAllData; for currency/tax toggle
  // we re-render KPIs but reload data for chart. This is acceptable.
  // Full re-fetch on every currency toggle would be wasteful; instead
  // we refresh the full data which re-draws everything.
  loadAllData();
}
