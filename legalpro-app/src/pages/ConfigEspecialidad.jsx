import { useState, useEffect, useRef } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import { api } from '../api/client';
import { useTenant } from '../context/TenantContext';

const ESPECIALIDADES = [
  { name: 'Derecho Penal', icon: 'gavel', value: 'PENAL' },
  { name: 'Derecho Civil', icon: 'balance', value: 'CIVIL' },
  { name: 'Derecho Laboral', icon: 'work', value: 'LABORAL' },
  { name: 'Derecho Constitucional', icon: 'account_balance', value: 'CONSTITUCIONAL' },
  { name: 'Derecho de Familia', icon: 'family_restroom', value: 'FAMILIA' },
  { name: 'Derecho Administrativo', icon: 'apartment', value: 'ADMINISTRATIVO' },
];

export default function ConfigEspecialidad() {
  const { usuario, refreshToken } = useTenant();
  const [selected, setSelected] = useState(usuario?.especialidad || 'GENERAL');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  // ── Cleanup del setTimeout "saved" para evitar setState tras unmount ──
  const savedTimerRef = useRef(null);
  useEffect(() => {
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    try {
      await api.updateMisDatos({ especialidad: selected });
      await refreshToken();
      setSaved(true);
      savedTimerRef.current = setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError('No se pudo guardar la especialidad. Intenta de nuevo.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-enter">
      <Header title="Especialidad Legal" showBack />
      <div className="px-4 py-6 space-y-6">
        <p className="text-sm text-slate-400">
          Configura tu especialidad para que la IA personalice sus respuestas y herramientas.
        </p>
        <div className="space-y-3">
          {ESPECIALIDADES.map((e) => {
            const isActive = selected === e.value;
            return (
              <button
                key={e.value}
                onClick={() => setSelected(e.value)}
                className={`card w-full flex items-center gap-3 ${isActive ? 'border-primary/50 bg-primary/10' : ''} active:scale-[0.98] transition-transform`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isActive ? 'bg-primary text-white' : 'bg-primary/10 text-primary'}`}>
                  <AppIcon name={e.icon} size={20} />
                </div>
                <span className="font-semibold text-sm flex-1 text-left">{e.name}</span>
                {isActive && <AppIcon name="check_circle" size={20} />}
              </button>
            );
          })}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        {saved && <p className="text-xs text-emerald-400">Especialidad guardada correctamente.</p>}
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary w-full disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar Configuración'}
        </button>
      </div>
    </div>
  );
}
