import { useState } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import { api } from '../api/client';

export default function GeneradorAlegatos() {
  const [tipoAlegato, setTipoAlegato] = useState('Alegato de Clausura - Defensa');
  const [teoriaDelCaso, setTeoriaDelCaso] = useState('');
  const [resultado, setResultado] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerar = async () => {
    if (!teoriaDelCaso.trim()) return;
    setLoading(true);
    setError('');
    try {
      const prompt = `Genera un ${tipoAlegato} para el siguiente caso:\n\nTeoría del caso: ${teoriaDelCaso}`;
      const data = await api.consulta(prompt, 'alegatos');
      setResultado(typeof data.resultado === 'string' ? data.resultado : JSON.stringify(data.resultado, null, 2));
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter">
      <Header title="Alegatos de Clausura IA" showBack rightAction={<span className="badge badge-primary">IA Gemini</span>} />
      <div className="px-4 py-6 space-y-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center"><AppIcon name="record_voice_over" size={20} /></div>
            <div><p className="font-bold text-sm">Caso de Colusión Agravada</p><p className="text-xs text-slate-400">Exp. 04532-2023-JR-PE</p></div>
          </div>
          <div className="flex gap-2"><span className="badge badge-warning">Penal</span><span className="badge badge-danger">Juicio Oral</span></div>
        </div>
        <div className="space-y-3">
          <label className="block"><span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Tipo de Alegato</span>
            <div className="relative">
              <select className="input appearance-none pr-10" value={tipoAlegato} onChange={e => setTipoAlegato(e.target.value)}>
                <option>Alegato de Clausura - Defensa</option>
                <option>Alegato de Clausura - Fiscal</option>
                <option>Alegato de Apertura</option>
              </select>
              <AppIcon name="expand_more" size={20} />
            </div>
          </label>
          <label className="block"><span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Teoría del Caso</span>
            <textarea
              className="input min-h-[80px] resize-none"
              placeholder="Describe brevemente tu teoría del caso..."
              value={teoriaDelCaso}
              onChange={e => setTeoriaDelCaso(e.target.value)}
            />
          </label>
        </div>
        {error && <p className="text-red-400 text-xs">{error}</p>}
        <button
          className="btn btn-primary w-full"
          onClick={handleGenerar}
          disabled={loading || !teoriaDelCaso.trim()}
        >
          <AppIcon name="auto_awesome" size={20} />
          {loading ? ' Analizando con Gemini...' : ' Generar Alegato con Gemini'}
        </button>
        <div className="card bg-primary/5 border-primary/20 min-h-[200px] p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Borrador del Alegato</h3>
          {resultado ? (
            <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">{resultado}</p>
          ) : (
            <>
              <p className="text-sm text-slate-300 leading-relaxed">Señor Juez, con el respeto que usted merece, quiero destacar que a lo largo de este juicio oral se ha demostrado fehacientemente que mi patrocinado...</p>
              <p className="text-sm text-slate-400 leading-relaxed mt-2">La prueba actuada demuestra que no existió un acuerdo previo entre los acusados. Los testimonios de los peritos confirman que las reuniones fueron de naturaleza técnica...</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
