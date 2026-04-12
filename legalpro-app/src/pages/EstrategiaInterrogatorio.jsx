import { useState } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import { api } from '../api/client';

export default function EstrategiaInterrogatorio() {
  const [tipoTestigo, setTipoTestigo] = useState('Testigo Directo');
  const [nombreTestigo, setNombreTestigo] = useState('');
  const [puntosProbar, setPuntosProbar] = useState('');
  const [resultado, setResultado] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerar = async () => {
    setLoading(true);
    setError('');
    try {
      const prompt = `Genera una estrategia de interrogatorio NCPP para un ${tipoTestigo}${nombreTestigo ? ` llamado ${nombreTestigo}` : ''}. Puntos a probar: ${puntosProbar || 'General'}`;
      const data = await api.consulta(prompt, 'interrogatorio');
      setResultado(typeof data.resultado === 'string' ? data.resultado : JSON.stringify(data.resultado, null, 2));
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const preguntasDefault = [
    { q: '¿Puede describir con exactitud lo que observó el día de los hechos?', tipo: 'Directa', icon: 'check_circle' },
    { q: '¿Es cierto que usted tiene un vínculo personal con el acusado?', tipo: 'Confrontación', icon: 'warning' },
    { q: '¿Cómo explica la contradicción entre su declaración policial y la actual?', tipo: 'Impeachment', icon: 'gavel' },
  ];

  return (
    <div className="page-enter">
      <Header title="Interrogatorio NCPP" showBack rightAction={<span className="badge badge-primary">IA Estratégica</span>} />
      <div className="px-4 py-6 space-y-6">
        <div className="card">
          <h3 className="text-sm font-bold mb-2">Configuración del Interrogatorio</h3>
          <div className="space-y-3">
            <label className="block"><span className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Rol</span>
              <div className="flex bg-surface-dark p-1 rounded-xl border border-border-dark">
                {['Fiscal', 'Abogado'].map(r => <button key={r} className="flex-1 py-2 rounded-lg text-sm font-medium text-center bg-primary text-white first:bg-transparent first:text-slate-400">{r}</button>)}
              </div>
            </label>
            <label className="block"><span className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Tipo de Testigo</span>
              <select className="input" value={tipoTestigo} onChange={e => setTipoTestigo(e.target.value)}>
                <option>Testigo Directo</option>
                <option>Perito</option>
                <option>Testigo de Descargo</option>
                <option>Agraviado</option>
              </select>
            </label>
            <label className="block"><span className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Nombre del Testigo (opcional)</span>
              <input
                className="input"
                placeholder="Nombre del testigo..."
                value={nombreTestigo}
                onChange={e => setNombreTestigo(e.target.value)}
              />
            </label>
            <label className="block"><span className="text-xs text-slate-500 uppercase tracking-wider mb-1 block">Puntos a Probar</span>
              <textarea
                className="input min-h-[80px] resize-none"
                placeholder="Describe los puntos que deseas probar con este testigo..."
                value={puntosProbar}
                onChange={e => setPuntosProbar(e.target.value)}
              />
            </label>
          </div>
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button className="btn btn-primary w-full" onClick={handleGenerar} disabled={loading || (!nombreTestigo.trim() && !puntosProbar.trim())}>
          <AppIcon name="psychology" size={20} />
          {loading ? ' Analizando con Gemini...' : ' Generar Estrategia'}
        </button>
        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Preguntas Sugeridas</h3>
          {resultado ? (
            <div className="card">
              <p className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">{resultado}</p>
            </div>
          ) : (
            preguntasDefault.map((p, i) => (
              <div key={i} className="card anim-fade-in-up" style={{ animationDelay: `${i * 0.1}s`, opacity: 0 }}>
                <div className="flex items-center gap-2 mb-2">
                  <AppIcon name={p.icon} size={20} />
                  <span className="badge badge-primary text-xs">{p.tipo}</span>
                </div>
                <p className="text-sm leading-relaxed">{p.q}</p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
