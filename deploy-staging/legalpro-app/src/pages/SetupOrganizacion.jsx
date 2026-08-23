import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
import { useTenant } from '../context/TenantContext';
import { api } from '../api/client';

const PLANES = [
  {
    key: 'FREE',
    nombre: 'Gratuito',
    precio: 'S/ 0',
    color: 'border-slate-600',
    iconColor: 'text-slate-400',
    icon: 'rocket_launch',
    features: ['3 usuarios', '10 expedientes', 'Chat IA básico'],
  },
  {
    key: 'PRO',
    nombre: 'Profesional',
    precio: 'S/ 99/mes',
    color: 'border-indigo-500',
    iconColor: 'text-indigo-400',
    icon: 'workspace_premium',
    features: ['15 usuarios', '200 expedientes', 'IA completa', 'SINOE monitor'],
    recomendado: true,
  },
  {
    key: 'ENTERPRISE',
    nombre: 'Enterprise',
    precio: 'S/ 299/mes',
    color: 'border-violet-500',
    iconColor: 'text-violet-400',
    icon: 'domain',
    features: ['100 usuarios', '5000 expedientes', 'IA ilimitada', 'Soporte prioritario'],
  },
];

export default function SetupOrganizacion() {
  const navigate = useNavigate();
  const { usuario, refreshToken } = useTenant();

  const [tab, setTab] = useState('crear'); // 'crear' | 'unir'
  const [plan, setPlan] = useState('FREE');
  const [nombreOrg, setNombreOrg] = useState('');
  const [tokenInvitacion, setTokenInvitacion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleCrear(e) {
    e.preventDefault();
    if (!nombreOrg.trim()) {
      setError('El nombre de la organización es obligatorio.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await api.createOrg({ nombre: nombreOrg.trim(), plan });
      // Refrescar token para incluir organization_id en JWT
      if (refreshToken) await refreshToken();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(err.message?.includes('409')
        ? 'Ya eres propietario de una organización.'
        : 'No se pudo crear la organización. Intenta nuevamente.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleUnirse(e) {
    e.preventDefault();
    if (!tokenInvitacion.trim()) {
      setError('El código de invitación es obligatorio.');
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      await api.acceptInvitation(tokenInvitacion.trim());
      if (refreshToken) await refreshToken();
      navigate('/dashboard', { replace: true });
    } catch (err) {
      const status = err.message?.match(/Error (\d+)/)?.[1];
      const msgs = {
        404: 'Código de invitación inválido o ya utilizado.',
        410: 'La invitación ha expirado. Solicita una nueva al administrador.',
        409: 'Ya eres miembro de esta organización.',
      };
      setError(msgs[status] ?? 'No se pudo procesar la invitación.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-6 bg-[#0f131a]">
      <div className="w-full max-w-lg">
        {/* HEADER */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center mx-auto mb-4">
            <AppIcon name="business_center" size={32} className="text-indigo-400" />
          </div>
          <h1 className="text-2xl font-black text-white mb-1">
            Configura tu <span className="text-indigo-400">Espacio Legal</span>
          </h1>
          <p className="text-sm text-slate-400">
            Hola, <span className="text-white font-medium">{usuario?.nombreCompleto ?? 'usuario'}</span>.
            Para continuar, crea tu organización o únete a una existente.
          </p>
        </div>

        {/* TABS */}
        <div className="flex rounded-xl bg-white/5 p-1 mb-6 gap-1">
          {[
            { key: 'crear', label: 'Crear organización', icon: 'add_business' },
            { key: 'unir', label: 'Unirme con código', icon: 'group_add' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setError(''); }}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                tab === t.key
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <AppIcon name={t.icon} size={16} />
              {t.label}
            </button>
          ))}
        </div>

        {/* CREAR ORGANIZACIÓN */}
        {tab === 'crear' && (
          <form onSubmit={handleCrear} className="space-y-5">
            {/* Nombre */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                Nombre de la organización
              </label>
              <input
                type="text"
                value={nombreOrg}
                onChange={e => setNombreOrg(e.target.value)}
                placeholder="Ej: Estudio García & Asociados"
                maxLength={100}
                required
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition"
              />
            </div>

            {/* Plan */}
            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-2 uppercase tracking-wide">
                Plan
              </label>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {PLANES.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setPlan(p.key)}
                    className={`relative flex flex-col items-start p-3 rounded-xl border-2 transition-all ${
                      plan === p.key
                        ? p.color + ' bg-white/5'
                        : 'border-white/5 bg-white/2 hover:border-white/10'
                    }`}
                  >
                    {p.recomendado && (
                      <span className="absolute -top-2 right-2 text-[10px] font-bold bg-indigo-600 text-white px-2 py-0.5 rounded-full">
                        Recomendado
                      </span>
                    )}
                    <AppIcon name={p.icon} size={20} className={p.iconColor + ' mb-1'} />
                    <p className="text-white font-semibold text-sm">{p.nombre}</p>
                    <p className="text-slate-400 text-xs mb-2">{p.precio}</p>
                    <ul className="space-y-0.5">
                      {p.features.map(f => (
                        <li key={f} className="flex items-center gap-1 text-[11px] text-slate-400">
                          <AppIcon name="check_circle" size={12} className="text-green-500 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || !nombreOrg.trim()}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <AppIcon name="progress_activity" size={20} className="animate-spin" />
              ) : (
                <AppIcon name="add_business" size={20} />
              )}
              {isLoading ? 'Creando...' : 'Crear organización'}
            </button>
          </form>
        )}

        {/* UNIRSE CON TOKEN */}
        {tab === 'unir' && (
          <form onSubmit={handleUnirse} className="space-y-5">
            <div className="p-4 rounded-xl bg-blue-500/10 border border-blue-500/20">
              <p className="text-sm text-blue-300">
                <AppIcon name="info" size={14} className="inline mr-1" />
                Solicita el código de invitación al <strong>administrador</strong> de la organización que deseas unirte.
              </p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1.5 uppercase tracking-wide">
                Código de invitación
              </label>
              <input
                type="text"
                value={tokenInvitacion}
                onChange={e => setTokenInvitacion(e.target.value)}
                placeholder="Pega aquí el código recibido"
                required
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder:text-slate-500 focus:border-indigo-500/50 focus:outline-none focus:ring-1 focus:ring-indigo-500/30 transition font-mono text-sm"
              />
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || !tokenInvitacion.trim()}
              className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <AppIcon name="progress_activity" size={20} className="animate-spin" />
              ) : (
                <AppIcon name="group_add" size={20} />
              )}
              {isLoading ? 'Procesando...' : 'Unirme a la organización'}
            </button>
          </form>
        )}

        {/* LOGOUT */}
        <div className="mt-8 text-center">
          <button
            onClick={() => {
              localStorage.removeItem('legalpro_token');
              window.location.href = '/login';
            }}
            className="text-xs text-slate-500 hover:text-slate-400 transition"
          >
            <AppIcon name="logout" size={12} className="inline mr-1" />
            Cerrar sesión
          </button>
        </div>
      </div>
    </div>
  );
}
