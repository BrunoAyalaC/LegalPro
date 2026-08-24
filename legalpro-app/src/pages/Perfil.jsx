import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Sliders, Bell, Shield, Sparkles, Download,
  HelpCircle, ChevronRight, LogOut, Building2,
  Trash2, FileText, Edit3, Save, X, AlertTriangle, Ban
} from 'lucide-react';
import { useTenant } from '../context/TenantContext';
import { api, nodeClient, revocarConsentimiento } from '../api/client';

const APK_URL = import.meta.env.VITE_APK_URL ?? null;

const container = {
  animate: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};
const item = {
  initial: { opacity: 0, y: 16, scale: 0.97 },
  animate: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35 } },
};

function DescargarAPK() {
  if (!APK_URL) return null;
  return (
    <motion.a
      variants={item}
      href={APK_URL}
      download="LegalPro.apk"
      className="flex items-center gap-3 p-4 rounded-2xl border border-cyan-500/30
        bg-cyan-500/5 backdrop-blur-xl mb-4 hover:bg-cyan-500/10 transition-all duration-300
        shadow-lg hover:shadow-cyan-500/15"
    >
      <div className="w-12 h-12 rounded-xl bg-cyan-500/15 flex items-center justify-center shrink-0
        shadow-lg shadow-cyan-500/20 border border-cyan-500/20">
        <Download size={24} className="text-cyan-400" />
      </div>
      <div className="flex-1">
        <p className="font-bold text-sm text-cyan-300">Descarga la app Android</p>
        <p className="text-[11px] text-slate-400 mt-0.5">Instala LegalPro en tu celular (APK)</p>
      </div>
      <div className="flex flex-col items-center shrink-0">
        <Download size={18} className="text-cyan-400" />
        <span className="text-xs text-cyan-500 font-bold uppercase mt-0.5">Gratis</span>
      </div>
    </motion.a>
  );
}

export default function Perfil() {
  const navigate = useNavigate();
  const { usuario, organizacion, logout, refreshToken } = useTenant();

  const [misDatos, setMisDatos] = useState(null);
  const [loadingDatos, setLoadingDatos] = useState(false);
  const [datosError, setDatosError] = useState('');

  const [editMode, setEditMode] = useState(false);
  const [nombreEdit, setNombreEdit] = useState('');
  const [especialidadEdit, setEspecialidadEdit] = useState('');
  const [saving, setSaving] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmDeleteText, setConfirmDeleteText] = useState('');
  const [deleting, setDeleting] = useState(false);

  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [passwordChanging, setPasswordChanging] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  // ── Revocación de consentimientos LPDP (Arts. 14, 15) ──
  const [revocando, setRevocando] = useState(null);
  const [revocacionMsg, setRevocacionMsg] = useState('');
  const [revocacionError, setRevocacionError] = useState('');
  const [showConsentimiento, setShowConsentimiento] = useState(false);

  // ── Oposición al tratamiento LPDP Art. 27 (LEG-06) ──
  const [oponiendo, setOponiendo] = useState(null);
  const [oposicionMsg, setOposicionMsg] = useState('');
  const [oposicionError, setOposicionError] = useState('');
  const [showOposicion, setShowOposicion] = useState(false);

  // ── MFA/TOTP (ADR-004-rev1): /api/auth/mfa/status|setup|verify|disable ──
  const [mfaEnabled, setMfaEnabled] = useState(null);        // null = cargando
  const [mfaNoDisponible, setMfaNoDisponible] = useState(false); // flag off / 404
  const [mfaSetup, setMfaSetup] = useState(null);            // { otpauth, qrUrl }
  const [mfaCode, setMfaCode] = useState('');
  const [mfaBusy, setMfaBusy] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [mfaMsg, setMfaMsg] = useState('');
  const [mfaBackupCodes, setMfaBackupCodes] = useState(null); // texto plano UNA vez
  const [showMfaDisable, setShowMfaDisable] = useState(false);
  const [mfaDisablePassword, setMfaDisablePassword] = useState('');

  // ── Cleanup de timers (logout diferido por revocación crítica) ──
  const revocacionTimerRef = useRef(null);
  useEffect(() => {
    return () => {
      if (revocacionTimerRef.current) clearTimeout(revocacionTimerRef.current);
    };
  }, []);

  const nombreCompleto = usuario?.nombreCompleto || usuario?.nombre || 'Usuario';
  const iniciales = nombreCompleto.split(' ').map(n => n.charAt(0)).join('').slice(0, 2).toUpperCase();
  const rol = usuario?.rol?.toLowerCase() || 'abogado';
  const especialidad = usuario?.especialidad || 'General';

  const cargarMisDatos = useCallback(async () => {
    setLoadingDatos(true);
    setDatosError('');
    try {
      const data = await api.getMisDatos();
      setMisDatos(data);
      setNombreEdit(data.usuario.nombreCompleto);
      setEspecialidadEdit(data.usuario.especialidad || '');
    } catch {
      setDatosError('No se pudieron cargar tus datos personales.');
    } finally {
      setLoadingDatos(false);
    }
  }, []);

  useEffect(() => {
    cargarMisDatos();
  }, [cargarMisDatos]);

  // ── MFA: cargar estado al montar ──
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data } = await nodeClient.get('/api/auth/mfa/status');
        if (!cancelled) setMfaEnabled(!!data?.data?.enabled);
      } catch {
        // 404/503 → FEATURE_MFA=false o backend antiguo: sección informativa
        if (!cancelled) setMfaNoDisponible(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const iniciarMfaSetup = async () => {
    setMfaError(''); setMfaMsg(''); setMfaBusy(true);
    try {
      const { data } = await nodeClient.post('/api/auth/mfa/setup');
      setMfaSetup(data?.data || null);
    } catch (err) {
      setMfaError(err?.response?.data?.error || 'No se pudo iniciar la configuración MFA.');
    } finally {
      setMfaBusy(false);
    }
  };

  const verificarMfa = async () => {
    setMfaError(''); setMfaMsg('');
    if (!/^\d{6}$/.test(mfaCode.trim())) {
      setMfaError('Ingresa el código de 6 dígitos de tu app autenticadora.');
      return;
    }
    setMfaBusy(true);
    try {
      const { data } = await nodeClient.post('/api/auth/mfa/verify', { code: mfaCode.trim() });
      setMfaEnabled(true);
      setMfaBackupCodes(data?.data?.backupCodes || []);
      setMfaSetup(null);
      setMfaCode('');
      setMfaMsg('✅ MFA activado correctamente.');
    } catch (err) {
      setMfaError(err?.response?.data?.error || 'Código inválido. Intenta nuevamente.');
    } finally {
      setMfaBusy(false);
    }
  };

  const desactivarMfa = async () => {
    setMfaError(''); setMfaMsg('');
    if (!mfaDisablePassword) {
      setMfaError('Ingresa tu contraseña para confirmar.');
      return;
    }
    setMfaBusy(true);
    try {
      await nodeClient.post('/api/auth/mfa/disable', { password: mfaDisablePassword });
      setMfaEnabled(false);
      setShowMfaDisable(false);
      setMfaDisablePassword('');
      setMfaBackupCodes(null);
      setMfaMsg('MFA desactivado.');
    } catch (err) {
      setMfaError(err?.response?.data?.error || 'No se pudo desactivar MFA.');
    } finally {
      setMfaBusy(false);
    }
  };

  const handleUpdate = async () => {
    if (!nombreEdit.trim()) return;
    setSaving(true);
    try {
      await api.updateMisDatos({
        nombreCompleto: nombreEdit.trim(),
        especialidad: especialidadEdit.trim(),
      });
      await refreshToken();
      await cargarMisDatos();
      setEditMode(false);
    } catch {
      setDatosError('Error al guardar los cambios.');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async () => {
    try {
      const res = await api.exportMisDatos();
      if (!res.ok) throw new Error('Error al exportar');
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const disposition = res.headers.get('content-disposition');
      a.download = disposition?.match(/filename="(.+)"/)?.[1] || 'mis-datos.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      setDatosError('Error al descargar la exportación.');
    }
  };

  const handleDeleteCuenta = async () => {
    if (confirmDeleteText.trim().toLowerCase() !== 'eliminar') {
      setDatosError('Debe escribir "eliminar" para confirmar.');
      return;
    }
    setDeleting(true);
    try {
      await api.deleteAccount();
      logout();
      navigate('/login');
    } catch {
      setDatosError('Error al eliminar la cuenta. Intenta nuevamente.');
      setDeleting(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const MENSAJES_REVOCACION = {
    terminos:
      '¿Revocar la aceptación de Términos y Condiciones? Tu cuenta será DESACTIVADA por seguridad.',
    privacidad:
      '¿Revocar la aceptación de Política de Privacidad? Tu cuenta será DESACTIVADA por seguridad.',
    marketing:
      '¿Revocar el consentimiento de marketing? Dejarás de recibir comunicaciones promocionales.',
    transferencia_internacional:
      '¿Revocar el consentimiento de transferencia internacional a proveedores de IA (DeepSeek vía OpenCode Go)? Las funciones de IA dejarán de estar disponibles.',
  };

  const handleRevocar = async (tipo) => {
    setRevocacionError('');
    setRevocacionMsg('');
    const ok = window.confirm(MENSAJES_REVOCACION[tipo]);
    if (!ok) return;

    setRevocando(tipo);
    try {
      const result = await revocarConsentimiento(tipo);
      setRevocacionMsg(result.mensaje || 'Consentimiento revocado.');
      await cargarMisDatos();
      if (result.cuenta_desactivada) {
        // Cuenta crítica: cerrar sesión tras 3s y redirigir al login
        if (revocacionTimerRef.current) clearTimeout(revocacionTimerRef.current);
        revocacionTimerRef.current = setTimeout(async () => {
          await logout();
          window.location.href = '/login';
        }, 3000);
      }
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Error al revocar el consentimiento.';
      setRevocacionError(msg);
    } finally {
      setRevocando(null);
    }
  };

  // ── Oposición al tratamiento LPDP Art. 27 (LEG-06) ──
  // Bloquea una finalidad específica SIN eliminar la cuenta (a diferencia de /cancelar).
  const FINALIDADES_OPOSICION = [
    { id: 'marketing', label: 'Marketing y comunicaciones', icon: '📧', desc: 'Comunicaciones promocionales y newsletters' },
    { id: 'ia_automatizada', label: 'Decisiones automatizadas con IA', icon: '🤖', desc: 'Análisis, predictor, redactor con DeepSeek V4 Flash' },
    { id: 'cesion_terceros', label: 'Cesión de datos a terceros', icon: '🤝', desc: 'Compartir datos con proveedores externos' },
    { id: 'elaboracion_perfiles', label: 'Elaboración de perfiles', icon: '👤', desc: 'Creación de perfiles de uso y comportamiento' },
    { id: 'tratamiento_estadistico', label: 'Tratamiento estadístico', icon: '📊', desc: 'Uso de datos para análisis agregados' },
    { id: 'todos', label: 'Todos los tratamientos no legales', icon: '🚫', desc: 'Tu cuenta seguirá activa para fines contractuales y legales' },
  ];

  const handleOposicion = async (finalidad) => {
    setOposicionError('');
    setOposicionMsg('');
    const motivo = window.prompt(
      `¿Por qué te opones a "${finalidad}"? (opcional, ayuda a nuestro cumplimiento LPDP)`
    );
    if (motivo === null) return; // usuario canceló

    setOponiendo(finalidad);
    try {
      const result = await api.oponerTratamiento(finalidad, motivo || undefined);
      const plazo = new Date(result.plazo_respuesta).toLocaleDateString('es-PE');
      setOposicionMsg(
        `${result.mensaje} Plazo de atención: ${plazo}. ${result.nota}`
      );
      await cargarMisDatos();
    } catch (err) {
      const msg = err?.response?.data?.error || err?.message || 'Error al registrar la oposición.';
      setOposicionError(msg);
    } finally {
      setOponiendo(null);
    }
  };

  return (
    <motion.div
      variants={container}
      initial="initial"
      animate="animate"
      className="p-4 lg:p-6 max-w-2xl mx-auto pb-24 lg:pb-8"
    >
      {/* Profile Card */}
      <motion.div
        variants={item}
        className="text-center mb-6 p-6 rounded-3xl backdrop-blur-xl bg-white/5
          border border-white/10 shadow-2xl shadow-black/20 overflow-hidden relative"
      >
        {/* Glow bg */}
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-40 h-40 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative">
          <div
            className="w-20 h-20 rounded-full bg-linear-to-br from-indigo-500 to-violet-600
              flex items-center justify-center mx-auto mb-3 shadow-xl overflow-hidden
              border-2 border-white/20"
            style={{ boxShadow: '0 8px 32px rgba(99, 102, 241, 0.35)' }}
          >
            <span className="text-2xl font-bold text-white">{iniciales}</span>
          </div>
          <h2 className="text-lg font-bold text-white">{nombreCompleto}</h2>
          <p className="text-sm text-slate-400 capitalize">{rol} · {especialidad}</p>

          <div className="flex justify-center gap-2 mt-3">
            <span className="px-3 py-1 text-xs font-bold rounded-full bg-blue-500/15 text-blue-400 border border-blue-500/25">
              {usuario?.email || 'sin email'}
            </span>
            <span className="px-2 py-1 text-xs font-bold rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              Activo
            </span>
          </div>

          {/* Organización */}
          {organizacion && (
            <div className="flex items-center justify-center gap-2 mt-4 px-4 py-2 mx-auto max-w-xs
              rounded-xl bg-white/5 border border-white/10">
              <Building2 size={14} className="text-blue-400 shrink-0" />
              <span className="text-xs font-bold text-white">{organizacion.nombre}</span>
              <span className="text-xs text-slate-400">· Plan {organizacion.plan}</span>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/8">
            <div>
              <p className="text-lg font-bold text-white">{organizacion?.expedientesUsados ?? '—'}</p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Casos</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">{misDatos?.estadisticasUso?.total_mensajes_chat ?? '—'}</p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Consultas IA</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">—</p>
              <p className="text-[10px] text-slate-400 uppercase font-semibold">Escritos</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Descarga APK Android */}
      <DescargarAPK />

      {/* Mis Datos Personales — Sección destacada */}
      <motion.div variants={item} className="mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Shield size={16} className="text-emerald-400" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Mis Datos Personales</h3>
        </div>

        <div className="rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-5 shadow-lg">
          {datosError && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
              {datosError}
            </div>
          )}

          {loadingDatos && !misDatos ? (
            <div className="flex items-center justify-center py-8">
              <div className="w-6 h-6 rounded-full border-2 border-cyan-500/30 border-t-cyan-400 animate-spin" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Datos */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Nombre completo</span>
                  {editMode ? (
                    <input
                      value={nombreEdit}
                      onChange={e => setNombreEdit(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-500/50 w-48"
                    />
                  ) : (
                    <span className="text-sm text-white font-medium">{misDatos?.usuario?.nombreCompleto || nombreCompleto}</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Email</span>
                  <span className="text-sm text-white font-medium">{misDatos?.usuario?.email || usuario?.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Especialidad</span>
                  {editMode ? (
                    <input
                      value={especialidadEdit}
                      onChange={e => setEspecialidadEdit(e.target.value)}
                      className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white outline-none focus:border-cyan-500/50 w-48"
                    />
                  ) : (
                    <span className="text-sm text-white font-medium">{misDatos?.usuario?.especialidad || especialidad}</span>
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Rol</span>
                  <span className="text-sm text-white font-medium capitalize">{misDatos?.usuario?.rol?.toLowerCase() || rol}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Miembro desde</span>
                  <span className="text-sm text-white font-medium">
                    {misDatos?.usuario?.creadoEn ? new Date(misDatos.usuario.creadoEn).toLocaleDateString('es-PE') : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Términos aceptados</span>
                  <span className="text-sm text-emerald-400 font-medium">
                    {misDatos?.usuario?.terminosAceptadosEn ? new Date(misDatos.usuario.terminosAceptadosEn).toLocaleDateString('es-PE') : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Privacidad aceptada</span>
                  <span className="text-sm text-emerald-400 font-medium">
                    {misDatos?.usuario?.privacidadAceptadaEn ? new Date(misDatos.usuario.privacidadAceptadaEn).toLocaleDateString('es-PE') : '—'}
                  </span>
                </div>
              </div>

              {/* Acciones */}
              <div className="flex flex-wrap gap-2 pt-4 border-t border-white/8">
                {editMode ? (
                  <>
                    <button
                      onClick={handleUpdate}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 text-xs font-bold hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
                    >
                      <Save size={14} />
                      {saving ? 'Guardando...' : 'Guardar'}
                    </button>
                    <button
                      onClick={() => { setEditMode(false); setNombreEdit(misDatos?.usuario?.nombreCompleto || ''); setEspecialidadEdit(misDatos?.usuario?.especialidad || ''); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-slate-300 border border-white/10 text-xs font-bold hover:bg-white/10 transition-colors"
                    >
                      <X size={14} />
                      Cancelar
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-bold hover:bg-cyan-500/20 transition-colors"
                    >
                      <Edit3 size={14} />
                      Editar datos
                    </button>
                    <button
                      onClick={handleExport}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 text-slate-300 border border-white/10 text-xs font-bold hover:bg-white/10 transition-colors"
                    >
                      <FileText size={14} />
                      Descargar mis datos
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* ── Cambiar Contraseña ── */}
      <motion.div variants={item} className="mb-4">
        <button
          onClick={() => { setShowChangePassword(!showChangePassword); setPasswordError(''); setPasswordSuccess(''); }}
          className="w-full flex items-center gap-3 text-left p-3.5 group
            backdrop-blur-xl bg-white/5 border border-white/10
            hover:bg-white/7 hover:border-white/20
            rounded-2xl transition-all duration-300 shadow-lg"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center
            shadow-lg border border-white/10 transition-transform duration-300
            group-hover:scale-110">
            <Shield size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-white">Cambiar Contraseña</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Actualiza tu contraseña de acceso</p>
          </div>
          <ChevronRight size={16} className={`text-slate-500 transition-transform duration-300 shrink-0 ${showChangePassword ? 'rotate-90' : ''}`} />
        </button>

        {showChangePassword && (
          <div className="mt-3 rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-5 shadow-lg">
            {passwordError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {passwordError}
              </div>
            )}
            {passwordSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                {passwordSuccess}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label htmlFor="current-password" className="block text-xs text-slate-400 mb-1.5 font-medium">
                  Contraseña actual
                </label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
                  placeholder="••••••••"
                />
              </div>
              <div>
                <label htmlFor="new-password" className="block text-xs text-slate-400 mb-1.5 font-medium">
                  Nueva contraseña
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
                  placeholder="Mínimo 8 caracteres"
                />
              </div>
              <div>
                <label htmlFor="confirm-new-password" className="block text-xs text-slate-400 mb-1.5 font-medium">
                  Confirmar nueva contraseña
                </label>
                <input
                  id="confirm-new-password"
                  type="password"
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-amber-500/50"
                  placeholder="Repite la contraseña"
                />
              </div>
              <button
                onClick={async () => {
                  setPasswordError('');
                  setPasswordSuccess('');

                  if (!currentPassword) { setPasswordError('Debes ingresar tu contraseña actual.'); return; }
                  if (newPassword.length < 8) { setPasswordError('La nueva contraseña debe tener al menos 8 caracteres.'); return; }
                  if (newPassword !== confirmNewPassword) { setPasswordError('Las contraseñas no coinciden.'); return; }
                  if (currentPassword === newPassword) { setPasswordError('La nueva contraseña debe ser diferente a la actual.'); return; }

                  setPasswordChanging(true);
                  try {
                    await nodeClient.post('/api/auth/change-password', {
                      currentPassword,
                      newPassword,
                      confirmNewPassword,
                    });
                    setPasswordSuccess('✅ Contraseña actualizada correctamente.');
                    setCurrentPassword('');
                    setNewPassword('');
                    setConfirmNewPassword('');
                    setTimeout(() => setShowChangePassword(false), 2000);
                  } catch (err) {
                    const msg = err?.response?.data?.error || err?.message || 'Error al cambiar la contraseña. Verifica tu contraseña actual e intenta nuevamente.';
                    setPasswordError(msg);
                  } finally {
                    setPasswordChanging(false);
                  }
                }}
                disabled={passwordChanging}
                className="w-full mt-2 py-2.5 rounded-xl bg-amber-500/15 text-amber-400 text-xs font-bold border border-amber-500/25 hover:bg-amber-500/25 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {passwordChanging ? (
                  <>
                    <div className="w-4 h-4 rounded-full border-2 border-amber-400/30 border-t-amber-400 animate-spin" />
                    Cambiando...
                  </>
                ) : (
                  'Cambiar Contraseña'
                )}
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Autenticación de Dos Factores (MFA/TOTP) — ADR-004-rev1 ──
          Endpoints: GET /api/auth/mfa/status | POST setup | POST verify |
          POST disable (auth-login-mfa.js, montado bajo /api/auth/mfa). */}
      <motion.div variants={item} className="mb-4">
        <div className="w-full p-3.5 backdrop-blur-xl bg-white/5 border border-white/10
          rounded-2xl transition-all duration-300 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center
              shadow-lg border border-white/10">
              <Shield size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-white">Autenticación de Dos Factores (MFA)</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {mfaEnabled === null && !mfaNoDisponible && 'Verificando estado…'}
                {mfaNoDisponible && 'No disponible en este momento.'}
                {mfaEnabled === false && !mfaNoDisponible && 'Protege tu cuenta con un código TOTP (Google Authenticator, Authy…).'}
                {mfaEnabled === true && 'Tu cuenta requiere un código de verificación en cada inicio de sesión.'}
              </p>
            </div>
            {!mfaNoDisponible && mfaEnabled !== null && (
              <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border shrink-0
                ${mfaEnabled
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
                  : 'bg-slate-500/15 text-slate-400 border-slate-500/25'}`}>
                {mfaEnabled ? 'Activo' : 'Inactivo'}
              </span>
            )}
          </div>

          {(mfaError || mfaMsg) && (
            <div role={mfaError ? 'alert' : 'status'}
              className={`mt-3 text-[11px] px-3 py-2 rounded-lg border ${
                mfaError
                  ? 'bg-red-500/10 border-red-500/25 text-red-400'
                  : 'bg-emerald-500/10 border-emerald-500/25 text-emerald-400'
              }`}>
              {mfaError || mfaMsg}
            </div>
          )}

          {/* Códigos de respaldo: se muestran UNA sola vez tras verificar */}
          {mfaBackupCodes && (
            <div className="mt-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
              <p className="text-xs font-bold text-amber-300 mb-1.5">
                Guarda estos códigos de respaldo ahora — no se mostrarán de nuevo:
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 font-mono text-[11px] text-amber-200">
                {mfaBackupCodes.map(c => <span key={c} className="px-1.5 py-0.5 bg-black/30 rounded">{c}</span>)}
              </div>
              <button
                onClick={() => { navigator.clipboard?.writeText(mfaBackupCodes.join('\n')); setMfaMsg('Códigos copiados al portapapeles.'); }}
                className="mt-2 text-[11px] text-amber-400 underline underline-offset-2 hover:text-amber-300"
              >
                Copiar todos
              </button>
            </div>
          )}

          {/* Paso 1: QR + URI otpauth */}
          {mfaSetup && !mfaEnabled && (
            <div className="mt-3 p-3 rounded-xl bg-black/20 border border-white/10">
              <p className="text-xs text-slate-300 mb-2">
                1. Escanea el QR con tu app autenticadora (o copia el código manualmente):
              </p>
              <div className="flex flex-col sm:flex-row items-start gap-3">
                <img
                  src={mfaSetup.qrUrl}
                  alt="Código QR de configuración MFA"
                  width={140} height={140}
                  className="rounded-lg bg-white p-1.5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <code className="block break-all text-[10px] text-cyan-300 bg-black/40 p-2 rounded-lg select-all">
                    {mfaSetup.otpauth}
                  </code>
                  <button
                    onClick={() => navigator.clipboard?.writeText(mfaSetup.otpauth)}
                    className="mt-1.5 text-[11px] text-cyan-400 underline underline-offset-2 hover:text-cyan-300"
                  >
                    Copiar código de configuración
                  </button>
                </div>
              </div>
              <p className="text-xs text-slate-300 mt-3 mb-1.5">2. Ingresa el código de 6 dígitos:</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={mfaCode}
                  onChange={e => setMfaCode(e.target.value.replace(/\D/g, ''))}
                  onKeyDown={e => { if (e.key === 'Enter') verificarMfa(); }}
                  placeholder="000000"
                  aria-label="Código de verificación de 6 dígitos"
                  className="w-32 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
                    tracking-[0.3em] font-mono outline-none focus:border-indigo-500/50"
                />
                <button
                  onClick={verificarMfa}
                  disabled={mfaBusy}
                  className="px-4 py-2 rounded-lg bg-indigo-500/15 text-indigo-300 text-xs font-bold
                    border border-indigo-500/25 hover:bg-indigo-500/25 transition-colors disabled:opacity-50"
                >
                  {mfaBusy ? 'Verificando…' : 'Verificar y activar'}
                </button>
                <button
                  onClick={() => { setMfaSetup(null); setMfaCode(''); setMfaError(''); }}
                  className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}

          {/* Acciones */}
          {!mfaNoDisponible && mfaEnabled === false && !mfaSetup && (
            <button
              onClick={iniciarMfaSetup}
              disabled={mfaBusy}
              className="mt-3 w-full py-2.5 rounded-xl bg-indigo-500/15 text-indigo-300 text-xs font-bold
                border border-indigo-500/25 hover:bg-indigo-500/25 transition-colors disabled:opacity-50
                flex items-center justify-center gap-2"
            >
              <Shield size={14} />
              {mfaBusy ? 'Generando…' : 'Activar MFA'}
            </button>
          )}

          {mfaEnabled === true && !showMfaDisable && (
            <button
              onClick={() => { setShowMfaDisable(true); setMfaError(''); setMfaMsg(''); }}
              className="mt-3 w-full py-2.5 rounded-xl bg-red-500/10 text-red-400 text-xs font-bold
                border border-red-500/25 hover:bg-red-500/20 transition-colors"
            >
              Desactivar MFA
            </button>
          )}

          {showMfaDisable && (
            <div className="mt-3 p-3 rounded-xl bg-red-500/5 border border-red-500/25">
              <p className="text-[11px] text-red-300 mb-2">
                Confirma con tu contraseña para desactivar la verificación en dos pasos:
              </p>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={mfaDisablePassword}
                  onChange={e => setMfaDisablePassword(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') desactivarMfa(); }}
                  autoComplete="current-password"
                  placeholder="Contraseña actual"
                  aria-label="Contraseña para desactivar MFA"
                  className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm
                    text-white outline-none focus:border-red-500/50"
                />
                <button
                  onClick={desactivarMfa}
                  disabled={mfaBusy}
                  className="px-4 py-2 rounded-lg bg-red-500/20 text-red-300 text-xs font-bold
                    border border-red-500/30 hover:bg-red-500/30 transition-colors disabled:opacity-50"
                >
                  {mfaBusy ? '…' : 'Confirmar'}
                </button>
                <button
                  onClick={() => { setShowMfaDisable(false); setMfaDisablePassword(''); }}
                  className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Menú clásico */}
      <div className="space-y-2">
        {[
          { icon: Sliders, label: 'Especialidad Legal', desc: 'Configura tu área de práctica', color: 'bg-violet-500/15 text-violet-400' },
          { icon: Bell, label: 'Notificaciones', desc: 'Alertas y recordatorios', color: 'bg-amber-500/15 text-amber-400' },
          { icon: Shield, label: 'Seguridad', desc: 'Contraseña y 2FA', color: 'bg-emerald-500/15 text-emerald-400' },
          { icon: Sparkles, label: 'Configuración IA', desc: 'Modelo IA y preferencias', color: 'bg-indigo-500/15 text-indigo-400' },
          { icon: Download, label: 'Exportar Datos', desc: 'Backup de expedientes', color: 'bg-cyan-500/15 text-cyan-400' },
          { icon: HelpCircle, label: 'Soporte', desc: 'Ayuda y documentación', color: 'bg-slate-500/15 text-slate-400' },
        ].map((menuItem, i) => {
          const Icon = menuItem.icon;
          return (
            <motion.button
              key={i}
              variants={item}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              className="w-full flex items-center gap-3 text-left p-3.5 group
                backdrop-blur-xl bg-white/5 border border-white/10
                hover:bg-white/7 hover:border-white/20
                rounded-2xl transition-all duration-300 shadow-lg"
            >
              <div className={`w-10 h-10 rounded-xl ${menuItem.color} flex items-center justify-center
                shadow-lg border border-white/10 transition-transform duration-300
                group-hover:scale-110`}>
                <Icon size={20} className="text-current" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-white">{menuItem.label}</p>
                <p className="text-[11px] text-slate-400 mt-0.5">{menuItem.desc}</p>
              </div>
              <ChevronRight size={16} className="text-slate-500 group-hover:text-slate-300 group-hover:translate-x-1 transition-all duration-300 shrink-0" />
            </motion.button>
          );
        })}
      </div>

      {/* Privacidad y Consentimiento — LPDP (Arts. 14, 15) */}
      <motion.div variants={item} className="mb-4">
        <button
          onClick={() => {
            setShowConsentimiento(!showConsentimiento);
            setRevocacionError('');
            setRevocacionMsg('');
          }}
          className="w-full flex items-center gap-3 text-left p-3.5 group
            backdrop-blur-xl bg-white/5 border border-white/10
            hover:bg-white/7 hover:border-white/20
            rounded-2xl transition-all duration-300 shadow-lg"
          data-testid="lpdp-consentimiento-toggle"
        >
          <div className="w-10 h-10 rounded-xl bg-cyan-500/15 text-cyan-400 flex items-center justify-center
            shadow-lg border border-white/10 transition-transform duration-300
            group-hover:scale-110">
            <Shield size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-white">Privacidad y Consentimiento (LPDP)</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Revoca tus consentimientos conforme a la Ley 29733 (Arts. 14, 15)
            </p>
          </div>
          <ChevronRight
            size={16}
            className={`text-slate-500 transition-transform duration-300 shrink-0 ${showConsentimiento ? 'rotate-90' : ''}`}
          />
        </button>

        {showConsentimiento && (
          <div className="mt-3 rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-5 shadow-lg">
            {revocacionMsg && (
              <div className="mb-4 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs">
                {revocacionMsg}
              </div>
            )}
            {revocacionError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {revocacionError}
              </div>
            )}

            <div className="space-y-2 text-sm">
              {[
                { tipo: 'terminos', label: 'Términos y Condiciones', icon: '📜', critico: true },
                { tipo: 'privacidad', label: 'Política de Privacidad', icon: '🔒', critico: true },
                { tipo: 'marketing', label: 'Marketing y Comunicaciones', icon: '📧', critico: false },
                { tipo: 'transferencia_internacional', label: 'Transferencia Internacional (IA)', icon: '🌐', critico: false },
              ].map(({ tipo, label, icon, critico }) => (
                <button
                  key={tipo}
                  onClick={() => handleRevocar(tipo)}
                  disabled={revocando !== null}
                  data-testid={`lpdp-revocar-${tipo}`}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg border transition disabled:opacity-50 ${
                    critico
                      ? 'bg-red-500/5 border-red-500/15 hover:border-red-500/40 hover:bg-red-500/10'
                      : 'bg-white/5 border-white/10 hover:border-amber-500/30 hover:bg-amber-500/5'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <span aria-hidden="true">{icon}</span>
                    <span className="text-white text-left">
                      Revocar {label}
                      {critico && (
                        <span className="block text-[10px] text-red-400/80 font-semibold uppercase mt-0.5">
                          Desactivará tu cuenta
                        </span>
                      )}
                    </span>
                  </span>
                  <span className={`text-xs font-semibold ${critico ? 'text-red-400' : 'text-amber-400'}`}>
                    {revocando === tipo ? 'Revocando...' : 'Revocar →'}
                  </span>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
              Conforme a la <strong className="text-slate-400">Ley N.º 29733</strong> (Ley de Protección
              de Datos Personales del Perú), tienes derecho a revocar tu consentimiento en cualquier
              momento, por el mismo medio que lo otorgaste. Arts. 14 y 15.
            </p>
          </div>
        )}
      </motion.div>

      {/* ── Derecho de OPOSICIÓN al tratamiento (LPDP Art. 27) — LEG-06 ──
          DISTINTO de cancelación: no borra la cuenta, solo bloquea finalidades específicas. */}
      <motion.div variants={item} className="mb-4">
        <button
          onClick={() => { setShowOposicion(!showOposicion); setOposicionError(''); setOposicionMsg(''); }}
          className="w-full flex items-center gap-3 text-left p-3.5 group
            backdrop-blur-xl bg-amber-500/5 border border-amber-500/15
            hover:bg-amber-500/10 hover:border-amber-500/25
            rounded-2xl transition-all duration-300 shadow-lg"
        >
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-400 flex items-center justify-center
            shadow-lg border border-white/10 transition-transform duration-300
            group-hover:scale-110">
            <Ban size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-amber-400">Derecho de Oposición (LPDP Art. 27)</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Oponte a un tratamiento específico SIN eliminar tu cuenta · Plazo: 10 días hábiles
            </p>
          </div>
          <ChevronRight
            size={16}
            className={`text-slate-500 transition-transform duration-300 shrink-0 ${showOposicion ? 'rotate-90' : ''}`}
          />
        </button>

        {showOposicion && (
          <div className="mt-3 rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-5 shadow-lg">
            {oposicionMsg && (
              <div className="mb-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
                {oposicionMsg}
              </div>
            )}
            {oposicionError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
                {oposicionError}
              </div>
            )}

            <div className="space-y-2 text-sm">
              {FINALIDADES_OPOSICION.map(({ id, label, icon, desc }) => (
                <button
                  key={id}
                  onClick={() => handleOposicion(id)}
                  disabled={oponiendo !== null}
                  data-testid={`lpdp-oposicion-${id}`}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-lg
                    bg-white/5 border border-white/10 hover:border-amber-500/30 hover:bg-amber-500/5
                    transition disabled:opacity-50"
                >
                  <span className="flex items-center gap-3">
                    <span aria-hidden="true">{icon}</span>
                    <span className="text-white text-left">
                      Oponerse a: {label}
                      <span className="block text-[10px] text-slate-500 font-normal mt-0.5">
                        {desc}
                      </span>
                    </span>
                  </span>
                  <span className="text-amber-400 text-xs font-semibold shrink-0 ml-2">
                    {oponiendo === id ? 'Registrando...' : 'Oponerse →'}
                  </span>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-slate-500 mt-4 leading-relaxed">
              Conforme al <strong className="text-slate-400">Art. 27 de la Ley N.º 29733</strong>, puedes
              oponerte al tratamiento de tus datos personales cuando concurran motivos fundados y
              legítimos relativos a una situación personal concreta. A diferencia de la cancelación
              (que elimina tu cuenta), la oposición <strong>bloquea finalidades específicas</strong>{' '}
              manteniendo tu cuenta activa para los fines contractuales y legales necesarios. Plazo
              máximo de respuesta: <strong>10 días hábiles</strong> (Art. 28).
            </p>
          </div>
        )}
      </motion.div>

      {/* Eliminar cuenta */}
      <motion.div variants={item} className="mt-4">
        <button
          onClick={() => setShowDeleteModal(true)}
          className="w-full flex items-center gap-3 text-left p-3.5 group
            backdrop-blur-xl bg-red-500/5 border border-red-500/15
            hover:bg-red-500/10 hover:border-red-500/25
            rounded-2xl transition-all duration-300 shadow-lg"
        >
          <div className="w-10 h-10 rounded-xl bg-red-500/15 text-red-400 flex items-center justify-center
            shadow-lg border border-white/10 transition-transform duration-300
            group-hover:scale-110">
            <Trash2 size={20} className="text-current" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-red-400">Eliminar mi cuenta</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Derecho al olvido (LPDP)</p>
          </div>
          <ChevronRight size={16} className="text-slate-500 group-hover:text-slate-300 group-hover:translate-x-1 transition-all duration-300 shrink-0" />
        </button>
      </motion.div>

      {/* Cerrar Sesión */}
      <motion.button
        id="btn-cerrar-sesion-perfil"
        variants={item}
        onClick={handleLogout}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.97 }}
        className="w-full mt-6 py-3.5 rounded-xl text-red-400 font-semibold text-sm
          border border-red-500/25 bg-red-500/8 hover:bg-red-500/15
          transition-all duration-300 flex items-center justify-center gap-2
          shadow-lg hover:shadow-red-500/10"
      >
        <LogOut size={16} />
        Cerrar Sesión
      </motion.button>

      {/* Modal de eliminación */}
      <AnimatePresence>
        {showDeleteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowDeleteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-[#0b0b12] border border-red-500/20 p-6 shadow-2xl"
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-red-500/15 flex items-center justify-center">
                  <AlertTriangle size={20} className="text-red-400" />
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm">Eliminar cuenta permanentemente</h4>
                  <p className="text-slate-400 text-[11px]">Esta acción no se puede deshacer</p>
                </div>
              </div>

              <div className="space-y-3 mb-5">
                <p className="text-slate-300 text-xs leading-relaxed">
                  Al eliminar tu cuenta:
                </p>
                <ul className="text-slate-400 text-[11px] list-disc pl-4 space-y-1">
                  <li>Tus datos personales serán anonimizados.</li>
                  <li>Tus mensajes de chat y simulaciones serán eliminados.</li>
                  <li>Perderás acceso a todos los expedientes y organizaciones.</li>
                  <li>Esta acción se realiza bajo tu derecho al olvido (Ley N.º 29733).</li>
                </ul>
              </div>

              <div className="mb-4">
                <label className="block text-xs text-slate-400 mb-2">
                  Escribe <strong className="text-white">eliminar</strong> para confirmar:
                </label>
                <input
                  value={confirmDeleteText}
                  onChange={e => setConfirmDeleteText(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500/50"
                  placeholder="eliminar"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setShowDeleteModal(false); setConfirmDeleteText(''); setDatosError(''); }}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-slate-300 text-xs font-bold border border-white/10 hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteCuenta}
                  disabled={deleting || confirmDeleteText.trim().toLowerCase() !== 'eliminar'}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/15 text-red-400 text-xs font-bold border border-red-500/25 hover:bg-red-500/25 transition-colors disabled:opacity-40"
                >
                  {deleting ? 'Eliminando...' : 'Sí, eliminar cuenta'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
