import { useState, useEffect } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import api from '../api/client';
import { useTenant } from '../context/TenantContext';
import EmptyState from '../components/EmptyState';

export default function OrganizacionMiembros() {
  const { usuario, organizacion } = useTenant();
  const [miembros, setMiembros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [rolInvitado, setRolInvitado] = useState('MEMBER');
  const [invitando, setInvitando] = useState(false);
  const [msgInvitacion, setMsgInvitacion] = useState('');

  const cargar = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await api.getMyOrgMembers();
      setMiembros(Array.isArray(data) ? data : []);
    } catch (err) {
      setError('No se pudieron cargar los miembros.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const handleInvitar = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setInvitando(true);
    setMsgInvitacion('');
    try {
      await api.invitarMiembro(email.trim(), rolInvitado);
      setMsgInvitacion('Invitación enviada correctamente.');
      setEmail('');
      cargar();
    } catch (err) {
      setMsgInvitacion('Error al enviar la invitación. Verifica el email.');
    } finally {
      setInvitando(false);
    }
  };

  const handleEliminar = async (userId) => {
    if (!confirm('¿Eliminar a este miembro de la organización?')) return;
    try {
      await api.removeMember(userId);
      cargar();
    } catch (err) {
      setError('No se pudo eliminar al miembro.');
    }
  };

  const esAdmin = usuario?.rol === 'ADMIN' || usuario?.rol === 'OWNER';

  return (
    <div className="page-enter">
      <Header title="Miembros de la Organización" showBack />
      <div className="px-4 py-6 space-y-6">
        {organizacion && (
          <div className="card p-4">
            <p className="text-sm font-bold text-white">{organizacion.nombre}</p>
            <p className="text-xs text-slate-400 capitalize">Plan {organizacion.plan}</p>
          </div>
        )}

        {esAdmin && (
          <form onSubmit={handleInvitar} className="card p-4 space-y-3">
            <p className="text-sm font-bold text-white">Invitar miembro</p>
            <div className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email del abogado"
                className="input flex-1"
                required
              />
              <select
                value={rolInvitado}
                onChange={(e) => setRolInvitado(e.target.value)}
                className="input bg-surface-dark"
              >
                <option value="MEMBER">Miembro</option>
                <option value="ADMIN">Admin</option>
                <option value="VIEWER">Visor</option>
              </select>
            </div>
            <button type="submit" disabled={invitando} className="btn btn-primary w-full disabled:opacity-50">
              {invitando ? 'Enviando...' : 'Enviar invitación'}
            </button>
            {msgInvitacion && (
              <p className={`text-xs ${msgInvitacion.includes('Error') ? 'text-red-400' : 'text-emerald-400'}`}>
                {msgInvitacion}
              </p>
            )}
          </form>
        )}

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : error ? (
          <p className="text-sm text-red-400 text-center">{error}</p>
        ) : miembros.length === 0 ? (
          <EmptyState
            title="Sin miembros"
            description="No hay otros miembros en esta organización."
          />
        ) : (
          <div className="space-y-3">
            <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">
              Miembros ({miembros.length})
            </p>
            {miembros.map((m) => (
              <div key={m.id} className="card flex items-center gap-3 p-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {(m.nombreCompleto || m.nombre || m.email || 'U').charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {m.nombreCompleto || m.nombre || m.email}
                  </p>
                  <p className="text-xs text-slate-400">{m.email}</p>
                </div>
                <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-1 rounded-full capitalize">
                  {m.rol?.toLowerCase?.() || m.rol}
                </span>
                {esAdmin && m.id !== usuario?.id && (
                  <button
                    onClick={() => handleEliminar(m.id)}
                    className="p-2 rounded-lg hover:bg-red-500/15 text-slate-400 hover:text-red-400 transition-colors"
                    aria-label="Eliminar miembro"
                  >
                    <AppIcon name="delete" size={18} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
