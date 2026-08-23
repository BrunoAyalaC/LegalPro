import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Sliders, Bell, Shield, Sparkles, Download,
  HelpCircle, ChevronRight, LogOut, Building2,
  Trash2, FileText, Edit3, Save, X, AlertTriangle
} from 'lucide-react';
import { useTenant } from '../context/TenantContext';
import { api, nodeClient } from '../api/client';

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

  // ── MFA TOTP ──
  const [mfaStatus, setMfaStatus] = useState(false);        // true=activado
  const [mfaStep, setMfaStep] = useState(0);                  // 0=oculto, 1=password, 2=QR, 3=verificar
  const [mfaPassword, setMfaPassword] = useState('');
  const [mfaSecret, setMfaSecret] = useState('');
  const [mfaQRCode, setMfaQRCode] = useState('');
  const [mfaToken, setMfaToken] = useState('');
  const [mfaError, setMfaError] = useState('');
  const [mfaSuccess, setMfaSuccess] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);

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

      {/* ── Autenticación de Dos Factores (MFA) ── */}
      <motion.div variants={item} className="mb-4">
        <button
          onClick={() => { setMfaStep(mfaStep === 0 ? 1 : 0); setMfaError(''); setMfaSuccess(''); }}
          className="w-full flex items-center gap-3 text-left p-3.5 group
            backdrop-blur-xl bg-white/5 border border-white/10
            hover:bg-white/7 hover:border-white/20
            rounded-2xl transition-all duration-300 shadow-lg"
        >
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 text-indigo-400 flex items-center justify-center
            shadow-lg border border-white/10 transition-transform duration-300
            group-hover:scale-110">
            <Shield size={20} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-white">Autenticación de Dos Factores (MFA)</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {mfaStatus ? (
                <span className="text-emerald-400 font-semibold">Activado — Se requiere código TOTP al iniciar sesión</span>
              ) : (
                'Protege tu cuenta con un segundo factor de autenticación'
              )}
            </p>
          </div>
          <span className={`px-2.5 py-1 text-[10px] font-bold uppercase rounded-full border shrink-0 ${
            mfaStatus
              ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25'
              : 'bg-slate-500/15 text-slate-400 border-slate-500/25'
          }`}>
            {mfaStatus ? 'Activado' : 'Desactivado'}
          </span>
          <ChevronRight size={16} className={`text-slate-500 transition-transform duration-300 shrink-0 ${mfaStep > 0 ? 'rotate-90' : ''}`} />
        </button>

        {(mfaStep > 0) && (
          <div className="mt-3 rounded-2xl backdrop-blur-xl bg-white/5 border border-white/10 p-5 shadow-lg">
            {mfaError && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{mfaError}</div>
            )}
            {mfaSuccess && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">{mfaSuccess}</div>
            )}

            {/* MFA ya activado: botón para desactivar */}
            {mfaStatus && mfaStep === 1 && (
              <div className="space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  El MFA está <strong className="text-emerald-400">activado</strong>. Para desactivarlo, ingresa tu contraseña y el código TOTP actual.
                </p>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Contraseña actual</label>
                  <input
                    type="password"
                    value={mfaPassword}
                    onChange={e => setMfaPassword(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50"
                    placeholder="••••••••"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1.5 font-medium">Código TOTP de 6 dígitos</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={mfaToken}
                    onChange={e => setMfaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50 text-center tracking-widest font-mono"
                    placeholder="000000"
                  />
                </div>
                <button
                  onClick={async () => {
                    setMfaError(''); setMfaSuccess('');
                    if (!mfaPassword) { setMfaError('Ingresa tu contraseña.'); return; }
                    if (mfaToken.length !== 6) { setMfaError('El código TOTP debe tener 6 dígitos.'); return; }
                    setMfaLoading(true);
                    try {
                      await nodeClient.post('/api/auth/mfa/disable', { password: mfaPassword, token: mfaToken });
                      setMfaStatus(false);
                      setMfaSuccess('🔓 MFA desactivado correctamente.');
                      setMfaPassword('');
                      setMfaToken('');
                      setTimeout(() => setMfaStep(0), 2000);
                    } catch (err) {
                      const msg = err?.response?.data?.error || err?.message || 'Error al desactivar MFA. Verifica tu contraseña y código.';
                      setMfaError(msg);
                    } finally {
                      setMfaLoading(false);
                    }
                  }}
                  disabled={mfaLoading}
                  className="w-full mt-2 py-2.5 rounded-xl bg-red-500/15 text-red-400 text-xs font-bold border border-red-500/25 hover:bg-red-500/25 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {mfaLoading ? (
                    <><div className="w-4 h-4 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin" /> Desactivando...</>
                  ) : 'Desactivar MFA'}
                </button>
              </div>
            )}

            {/* MFA desactivado: wizard de activación */}
            {!mfaStatus && (
              <>
                {/* Step indicator */}
                <div className="flex items-center gap-2 mb-5">
                  {[1, 2, 3].map(s => (
                    <div key={s} className="flex items-center gap-2 flex-1">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        mfaStep >= s ? 'bg-indigo-500/30 text-indigo-300 border border-indigo-500/40' : 'bg-slate-500/20 text-slate-500 border border-slate-500/20'
                      }`}>
                        {s}
                      </div>
                      {s < 3 && <div className={`h-px flex-1 transition-colors ${mfaStep > s ? 'bg-indigo-500/30' : 'bg-white/8'}`} />}
                    </div>
                  ))}
                </div>

                {/* Paso 1: Confirmar identidad con contraseña */}
                {mfaStep === 1 && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Para configurar MFA, primero confirma tu identidad ingresando tu contraseña.
                    </p>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5 font-medium">Contraseña actual</label>
                      <input
                        type="password"
                        value={mfaPassword}
                        onChange={e => setMfaPassword(e.target.value)}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50"
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => { setMfaStep(0); setMfaPassword(''); setMfaError(''); }}
                        className="flex-1 py-2.5 rounded-xl bg-white/5 text-slate-300 text-xs font-bold border border-white/10 hover:bg-white/10 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={async () => {
                          setMfaError('');
                          if (!mfaPassword) { setMfaError('Debes ingresar tu contraseña.'); return; }
                          setMfaLoading(true);
                          try {
                            const res = await nodeClient.post('/api/auth/mfa/setup', { password: mfaPassword });
                            const data = res.data?.data ?? res.data;
                            setMfaSecret(data.secret || '');
                            setMfaQRCode(data.qrCode || '');
                            setMfaStep(2);
                          } catch (err) {
                            const msg = err?.response?.data?.error || err?.message || 'Error al iniciar configuración MFA. Verifica tu contraseña.';
                            setMfaError(msg);
                          } finally {
                            setMfaLoading(false);
                          }
                        }}
                        disabled={mfaLoading}
                        className="flex-1 py-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 text-xs font-bold border border-indigo-500/25 hover:bg-indigo-500/25 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {mfaLoading ? (
                          <><div className="w-4 h-4 rounded-full border-2 border-indigo-400/30 border-t-indigo-400 animate-spin" /> Verificando...</>
                        ) : 'Confirmar identidad'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Paso 2: Mostrar QR + Secret */}
                {mfaStep === 2 && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Escanea el siguiente código en tu aplicación de autenticación (Google Authenticator, Authy, etc.).
                    </p>
                    {/* QR simulado */}
                    <div className="flex flex-col items-center gap-3 p-4 rounded-xl bg-white/5 border border-white/10">
                      <div className="w-48 h-48 bg-white rounded-xl flex items-center justify-center shadow-lg">
                        <div className="text-center">
                          <div className="grid grid-cols-8 gap-0.5 mx-auto w-40 h-40">
                            {Array.from({ length: 64 }, (_, i) => (
                              <div
                                key={i}
                                className={`${Math.random() > 0.5 ? 'bg-indigo-900' : 'bg-indigo-200'} rounded-sm`}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400 text-center leading-relaxed max-w-xs">
                        Escanea este código QR con tu app de autenticación
                      </p>
                    </div>
                    {/* Secret key */}
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5 font-medium">O ingresa manualmente esta clave secreta:</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 bg-black/30 border border-white/10 rounded-lg px-3 py-2 text-sm text-cyan-300 font-mono select-all">
                          {mfaSecret || 'N/A'}
                        </code>
                        <button
                          onClick={() => { navigator.clipboard.writeText(mfaSecret); }}
                          className="p-2 rounded-lg bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors"
                          title="Copiar clave secreta"
                        >
                          <FileText size={14} />
                        </button>
                      </div>
                    </div>
                    <button
                      onClick={() => setMfaStep(3)}
                      className="w-full mt-1 py-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 text-xs font-bold border border-indigo-500/25 hover:bg-indigo-500/25 transition-colors"
                    >
                      Ya escaneé el código — Continuar
                    </button>
                  </div>
                )}

                {/* Paso 3: Verificar código TOTP */}
                {mfaStep === 3 && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-300 leading-relaxed">
                      Ingresa el código de 6 dígitos que aparece en tu aplicación de autenticación para verificar la configuración.
                    </p>
                    <div>
                      <label className="block text-xs text-slate-400 mb-1.5 font-medium">Código de verificación</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={mfaToken}
                        onChange={e => setMfaToken(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-3 text-lg text-white outline-none focus:border-indigo-500/50 text-center tracking-[0.5em] font-mono"
                        placeholder="000000"
                      />
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        onClick={() => { setMfaStep(2); setMfaToken(''); setMfaError(''); }}
                        className="flex-1 py-2.5 rounded-xl bg-white/5 text-slate-300 text-xs font-bold border border-white/10 hover:bg-white/10 transition-colors"
                      >
                        Volver
                      </button>
                      <button
                        onClick={async () => {
                          setMfaError(''); setMfaSuccess('');
                          if (mfaToken.length !== 6) { setMfaError('El código debe tener 6 dígitos.'); return; }
                          setMfaLoading(true);
                          try {
                            await nodeClient.post('/api/auth/mfa/verify', { token: mfaToken });
                            setMfaStatus(true);
                            setMfaSuccess('✅ MFA activado correctamente. A partir de ahora se te solicitará un código TOTP al iniciar sesión.');
                            setMfaToken('');
                            setTimeout(() => setMfaStep(0), 2500);
                          } catch (err) {
                            const msg = err?.response?.data?.error || err?.message || 'Código inválido. Verifica el código en tu aplicación e intenta nuevamente.';
                            setMfaError(msg);
                          } finally {
                            setMfaLoading(false);
                          }
                        }}
                        disabled={mfaLoading}
                        className="flex-1 py-2.5 rounded-xl bg-indigo-500/15 text-indigo-400 text-xs font-bold border border-indigo-500/25 hover:bg-indigo-500/25 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                        {mfaLoading ? (
                          <><div className="w-4 h-4 rounded-full border-2 border-indigo-400/30 border-t-indigo-400 animate-spin" /> Verificando...</>
                        ) : 'Verificar y Activar'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </motion.div>

      {/* Menú clásico */}
      <div className="space-y-2">
        {[
          { icon: Sliders, label: 'Especialidad Legal', desc: 'Configura tu área de práctica', color: 'bg-violet-500/15 text-violet-400' },
          { icon: Bell, label: 'Notificaciones', desc: 'Alertas y recordatorios', color: 'bg-amber-500/15 text-amber-400' },
          { icon: Shield, label: 'Seguridad', desc: 'Contraseña y 2FA', color: 'bg-emerald-500/15 text-emerald-400' },
          { icon: Sparkles, label: 'Configuración IA', desc: 'Modelo Gemini y preferencias', color: 'bg-indigo-500/15 text-indigo-400' },
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
