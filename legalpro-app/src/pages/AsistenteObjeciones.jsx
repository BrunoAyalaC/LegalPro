import { useState } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import { api } from '../api/client';

export default function AsistenteObjeciones() {
  const [situacion, setSituacion] = useState('');
  const [resultado, setResultado] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAnalizar = async () => {
    if (!situacion.trim()) return;
    setLoading(true);
    setError('');
    try {
      const prompt = `Como asistente de objeciones NCPP, analiza la siguiente declaración o pregunta del oponente y sugiere el tipo de objeción aplicable con el artículo del NCPP correspondiente: ${situacion}`;
      const data = await api.consulta(prompt, 'general');
      setResultado(typeof data.resultado === 'string' ? data.resultado : JSON.stringify(data.resultado, null, 2));
    } catch (e) {
      setError('Error al conectar con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const objecionesComunes = [
    { tipo: 'Pregunta Sugestiva', art: 'Art. 170.3 NCPP', desc: 'La pregunta sugiere la respuesta al testigo', color: 'border-amber-500' },
    { tipo: 'Pregunta Capciosa', art: 'Art. 170.3 NCPP', desc: 'Contiene engaño o confusión', color: 'border-red-500' },
    { tipo: 'Pregunta Impertinente', art: 'Art. 170.1 NCPP', desc: 'No guarda relación con los hechos', color: 'border-orange-500' },
    { tipo: 'Pregunta Repetitiva', art: 'Art. 170.6 NCPP', desc: 'Ya fue respondida anteriormente', color: 'border-blue-500' },
    { tipo: 'Testimonio de Oídas', art: 'Art. 166.2 NCPP', desc: 'Información no percibida directamente', color: 'border-purple-500' },
  ];

  return (
    <div className="page-enter">
      <Header title="Objeciones en Vivo" showBack rightAction={<span className="badge badge-danger">LIVE</span>} />
      <div className="px-4 py-6 space-y-6">
        <div className="card bg-red-500/10 border-red-500/20 text-center p-6">
          <AppIcon name="front_hand" size={20} />
          <h2 className="text-lg font-bold">Modo Audiencia</h2>
          <p className="text-xs text-slate-400 mt-1">Asistencia en tiempo real durante audiencias</p>
        </div>

        <label className="block">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Declaración u Pregunta Objetable</span>
          <textarea
            className="input min-h-[80px] resize-none"
            placeholder="Describe lo que dijo el oponente para analizar la objeción aplicable..."
            value={situacion}
            onChange={e => setSituacion(e.target.value)}
          />
        </label>

        {error && <p className="text-red-400 text-xs">{error}</p>}

        {resultado && (
          <div className="card bg-primary/10 border-primary/20">
            <div className="flex items-center gap-2 mb-2">
              <AppIcon name="psychology" size={20} />
              <span className="text-sm font-bold text-primary">Análisis Gemini</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed whitespace-pre-wrap">{resultado}</p>
          </div>
        )}

        <div className="space-y-3">
          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Objeciones Comunes</h3>
          {objecionesComunes.map((o, i) => (
            <button key={i} className={`card w-full text-left border-l-4 ${o.color} active:scale-[0.98] transition-transform anim-fade-in-up`}
              style={{ animationDelay: `${i * 0.08}s`, opacity: 0 }}>
              <div className="flex items-center justify-between mb-1">
                <span className="font-bold text-sm">{o.tipo}</span>
                <span className="badge badge-primary text-[9px]">{o.art}</span>
              </div>
              <p className="text-xs text-slate-400">{o.desc}</p>
            </button>
          ))}
        </div>

        <button
          className="btn btn-primary w-full"
          onClick={handleAnalizar}
          disabled={loading || !situacion.trim()}
        >
          <AppIcon name={loading ? 'sync' : 'mic'} size={20} />
          {loading ? ' Analizando con Gemini...' : ' Analizar con Gemini'}
        </button>
      </div>
    </div>
  );
}
