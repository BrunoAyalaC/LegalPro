import { useState } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import IADisclaimerBanner from '../components/IADisclaimerBanner';
import { api } from '../api/client';

export default function ComparadorPrecedentes() {
  const [casacionA, setCasacionA] = useState('');
  const [casacionB, setCasacionB] = useState('');
  const [resultado, setResultado] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleComparar = async () => {
    if (!casacionA.trim() || !casacionB.trim()) return;
    setLoading(true);
    setError('');
    try {
      const data = await api.consulta?.(`Comparar casación ${casacionA} con ${casacionB}`, 'comparador');
      setResultado(data?.resultado ?? null);
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter">
      <Header title="Comparador Precedentes" showBack rightAction={<span className="badge badge-primary">INDECOPI/TC</span>} />
      <div className="px-4 py-6 space-y-6">
        {/* LPDP Art.21: disclaimer predictor obligatorio, no dismissible (regla dura #10) */}
        <IADisclaimerBanner variant="predictor" dismissible={false} />

        <div className="space-y-3">
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Casación A</span>
            <div className="input flex items-center gap-2">
              <AppIcon name="search" size={20} />
              <input
                className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-slate-500"
                placeholder="Número de casación..."
                value={casacionA}
                onChange={e => setCasacionA(e.target.value)}
              />
            </div>
          </label>
          <label className="block">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Casación B</span>
            <div className="input flex items-center gap-2">
              <AppIcon name="search" size={20} />
              <input
                className="bg-transparent border-none outline-none text-sm flex-1 placeholder:text-slate-500"
                placeholder="Número de casación..."
                value={casacionB}
                onChange={e => setCasacionB(e.target.value)}
              />
            </div>
          </label>
        </div>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button
          className="btn btn-primary w-full"
          onClick={handleComparar}
          disabled={loading || !casacionA.trim() || !casacionB.trim()}
        >
          <AppIcon name="auto_awesome" size={20} />
          {loading ? ' Analizando...' : ' Comparar con IA'}
        </button>

        {resultado ? (
          <div className="card bg-primary/5 border-primary/20 p-4">
            <h3 className="text-sm font-bold flex items-center gap-2 mb-3"><AppIcon name="compare" size={20} /> Análisis Comparativo IA</h3>
            <p className="text-xs text-slate-400 leading-relaxed">{typeof resultado === 'string' ? resultado : JSON.stringify(resultado)}</p>
          </div>
        ) : (
          <div className="card text-center py-8">
            <AppIcon name="compare" size={32} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm text-slate-400">Ingresa los números de dos casaciones para comparar sus fundamentos.</p>
          </div>
        )}
      </div>
    </div>
  );
}
