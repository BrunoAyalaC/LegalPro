import { useState } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import { api } from '../api/client';

export default function RedactorEscritos() {
  const [tipoEscrito, setTipoEscrito] = useState('Demanda de Alimentos');
  const [distritoJudicial, setDistritoJudicial] = useState('Corte Superior de Lima');
  const [hechos, setHechos] = useState('');
  const [resultado, setResultado] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGenerar = async () => {
    if (!hechos.trim()) return;
    setLoading(true);
    setError('');
    try {
      const prompt = `Redacta un escrito legal de tipo "${tipoEscrito}" para la "${distritoJudicial}". Hechos del caso: ${hechos}`;
      const data = await api.consulta(prompt, 'redaccion');
      setResultado(typeof data.resultado === 'string' ? data.resultado : JSON.stringify(data.resultado, null, 2));
    } catch {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-enter">
      <Header title="Redactor Legal Gemini" showBack rightAction={<AppIcon name="auto_awesome" size={20} />} />
      
      <main className="pb-28">
        <section className="p-4 space-y-4">
          <div className="space-y-3">
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Tipo de Escrito</span>
              <div className="relative">
                <select className="input appearance-none pr-10" value={tipoEscrito} onChange={e => setTipoEscrito(e.target.value)}>
                  <option>Demanda de Alimentos</option>
                  <option>Recurso de Apelación</option>
                  <option>Contestación de Demanda</option>
                  <option>Habeas Corpus</option>
                </select>
                <AppIcon name="expand_more" size={20} />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Distrito Judicial</span>
              <div className="relative">
                <select className="input appearance-none pr-10" value={distritoJudicial} onChange={e => setDistritoJudicial(e.target.value)}>
                  <option>Corte Superior de Lima</option>
                  <option>Corte Superior de Lima Norte</option>
                  <option>Corte Superior de Arequipa</option>
                </select>
                <AppIcon name="location_on" size={20} />
              </div>
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Hechos del Caso</span>
              <textarea
                className="input min-h-[100px] resize-none"
                placeholder="Describe los hechos relevantes del caso..."
                value={hechos}
                onChange={e => setHechos(e.target.value)}
              />
            </label>
          </div>

          {error && <p className="text-red-400 text-xs">{error}</p>}
          <button
            className="btn btn-primary w-full"
            onClick={handleGenerar}
            disabled={loading || !hechos.trim()}
          >
            <AppIcon name="auto_awesome" size={20} />
            {loading ? ' Analizando con Gemini...' : ' Generar Escrito con Gemini'}
          </button>

          <div className="bg-primary/10 border border-primary/20 rounded-xl p-3 flex items-center gap-3">
            <div className="bg-primary p-2 rounded-lg"><AppIcon name="upload_file" size={20} /></div>
            <div className="flex-1">
              <p className="text-xs font-bold text-primary">Documentos Analizados</p>
              <p className="text-[10px] text-slate-400 uppercase">Expediente N° 04231-2023-0</p>
            </div>
            <button className="text-xs font-semibold text-primary">Cambiar</button>
          </div>
        </section>

        <section className="px-4 py-2">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold flex items-center gap-2">
              <AppIcon name="edit_note" size={20} />Borrador Inteligente
            </h2>
            <span className="badge badge-success">GEMINI 2.0</span>
          </div>
          <div className="card space-y-4 p-5 min-h-[350px]">
            {resultado ? (
              <p className="text-xs leading-relaxed text-slate-300 whitespace-pre-wrap">{resultado}</p>
            ) : (
              <>
                <div className="text-center space-y-1 mb-6">
                  <p className="text-[10px] font-bold uppercase underline text-slate-300">Secretario: [POR DESIGNAR]</p>
                  <p className="text-[10px] font-bold uppercase underline text-slate-300">Expediente: [EN TRÁMITE]</p>
                  <p className="text-[10px] font-bold uppercase underline text-slate-300">Sumilla: DEMANDA DE ALIMENTOS</p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-tight">I. PETITORIO</h3>
                  <p className="text-xs leading-relaxed text-slate-400">Que, en vía de proceso sumarísimo, interpongo demanda de alimentos contra don [NOMBRE DEL DEMANDADO], a fin de que cumpla con asignar una pensión alimenticia mensual...</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-tight">II. FUNDAMENTOS DE HECHO</h3>
                    <button className="text-[10px] text-primary flex items-center gap-1" onClick={handleGenerar} disabled={loading}>
                      <AppIcon name="refresh" size={20} /> Regenerar
                    </button>
                  </div>
                  <p className="text-xs leading-relaxed text-slate-400">1. La recurrente contrajo matrimonio con el demandado en fecha..., habiendo procreado a los menores...</p>
                  <p className="text-xs leading-relaxed text-slate-400">2. El demandado ha hecho abandono del hogar conyugal, desentendiéndose de sus obligaciones económicas...</p>
                </div>
                <div className="space-y-2">
                  <h3 className="text-xs font-bold uppercase tracking-tight">III. FUNDAMENTOS DE DERECHO</h3>
                  <div className="flex flex-wrap gap-2">
                    {['Art. 472 Código Civil', 'Art. 481 Código Civil', 'Art. 546 CPC'].map(a => (
                      <span key={a} className="text-[10px] bg-surface-dark border border-border-dark px-2 py-1 rounded text-primary font-medium">{a}</span>
                    ))}
                  </div>
                </div>
              </>
            )}
            <div className="pt-4 flex justify-end gap-2 border-t border-border-dark">
              <button className="btn btn-secondary text-xs py-2 px-3"><AppIcon name="list_alt" size={20} /> Anexos</button>
              <button className="btn btn-primary text-xs py-2 px-3"><AppIcon name="picture_as_pdf" size={20} /> Vista Previa</button>
            </div>
          </div>
        </section>

        <section className="px-4 py-4 mb-4">
          <div className="card bg-surface-dark">
            <h4 className="text-xs font-bold text-slate-300 mb-3 flex items-center gap-2"><AppIcon name="attach_file" size={20} /> ANEXOS REQUERIDOS</h4>
            <ul className="space-y-3">
              {[
                { name: 'Copia de DNI del demandante', done: true },
                { name: 'Acta de Nacimiento del menor', done: true },
                { name: 'Documentos que acrediten gastos', done: false },
              ].map((a, i) => (
                <li key={i} className="flex items-center justify-between text-[11px]">
                  <span className="text-slate-400 flex items-center gap-2">
                    <AppIcon name={a.done ? 'check_circle' : 'add_circle'} size={20} />{a.name}
                  </span>
                  {a.done ? <span className="text-slate-500 italic">Subido</span> : <button className="text-primary font-bold">Subir</button>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <div className="fixed bottom-24 right-4 z-10">
        <button className="bg-primary hover:bg-primary/90 text-white p-4 rounded-full shadow-lg active:scale-95 transition-transform anim-pulse-glow">
          <AppIcon name="smart_toy" size={20} />
        </button>
      </div>
    </div>
  );
}
