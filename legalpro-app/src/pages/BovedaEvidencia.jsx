import { useState } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import { generateCustodyPDF } from '../utils/documents';

export default function BovedaEvidencia() {
  const [evidencias, setEvidencias] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [tipo, setTipo] = useState('documento');
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');

  const iconMap = { imagen: 'image', documento: 'description', video: 'videocam' };

  const handleAgregar = () => {
    if (!titulo.trim()) return;
    const nueva = {
      id: Date.now(),
      name: titulo,
      tipo,
      descripcion,
      fecha: new Date().toLocaleDateString(),
      verificado: false,
    };
    setEvidencias(prev => [...prev, nueva]);
    setTitulo('');
    setDescripcion('');
    setTipo('documento');
    setShowForm(false);
  };

  return (
    <div className="page-enter">
      <Header title="Bóveda de Evidencia" showBack rightAction={<AppIcon name="security" size={20} />} />
      <div className="px-4 py-6 space-y-6">
        <div className="card bg-emerald-500/10 border-emerald-500/20 flex items-center gap-3 p-4">
          <AppIcon name="verified_user" size={20} />
          <div>
            <p className="font-bold text-sm text-emerald-400">Cadena de Custodia</p>
            <p className="text-xs text-slate-400">{evidencias.filter(e => e.verificado).length}/{evidencias.length} evidencias verificadas</p>
          </div>
        </div>

        {evidencias.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            <AppIcon name="security" size={40} className="mx-auto mb-4 opacity-50" />
            <p className="text-sm">No hay evidencia registrada. Agrega archivos para mantener la cadena de custodia digital.</p>
          </div>
        )}

        <div className="space-y-3">
          {evidencias.map((e, i) => (
            <div key={e.id ?? i} className="card anim-fade-in-up" style={{ animationDelay: `${i * 0.1}s`, opacity: 0 }}>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><AppIcon name={iconMap[e.tipo] || 'description'} size={20} /></div>
                <div className="flex-1">
                  <p className="font-semibold text-sm">{e.name}</p>
                  <p className="text-xs text-slate-400">{e.tipo} • {e.fecha}</p>
                  {e.descripcion && <p className="text-xs text-slate-500 mt-1">{e.descripcion}</p>}
                </div>
                <AppIcon name={e.verificado ? 'check_circle' : 'pending'} size={20} />
              </div>
            </div>
          ))}
        </div>

        {showForm && (
          <div className="card space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Agregar Evidencia</h4>
            <label className="block">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Título</span>
              <input className="input" placeholder="Título de la evidencia" value={titulo} onChange={e => setTitulo(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Descripción</span>
              <textarea className="input min-h-[60px] resize-none" placeholder="Descripción..." value={descripcion} onChange={e => setDescripcion(e.target.value)} />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Tipo</span>
              <select className="input" value={tipo} onChange={e => setTipo(e.target.value)}>
                <option value="documento">Documento</option>
                <option value="imagen">Imagen</option>
                <option value="video">Video</option>
              </select>
            </label>
            <div className="flex gap-2">
              <button className="btn btn-secondary flex-1 text-xs" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary flex-1 text-xs" onClick={handleAgregar} disabled={!titulo.trim()}>Guardar</button>
            </div>
          </div>
        )}

        {exportError && <p className="text-red-400 text-xs text-center">{exportError}</p>}
        {!showForm && (
          <div className="flex flex-col gap-2">
            <button 
              className="btn btn-secondary w-full text-xs"
              onClick={async () => {
                setExportLoading(true);
                setExportError('');
                try {
                  const today = new Date().toISOString().split('T')[0];
                  await generateCustodyPDF(evidencias, `Cadena_Custodia_${today}.pdf`);
                } catch {
                  setExportError('Error al generar el PDF. Intenta de nuevo.');
                } finally {
                  setExportLoading(false);
                }
              }}
              disabled={exportLoading || evidencias.length === 0}
            >
              <AppIcon name="security" size={20} /> {exportLoading ? 'Generando...' : 'Generar Cadena de Custodia PDF'}
            </button>
            <button className="btn btn-primary w-full" onClick={() => setShowForm(true)}>
              <AppIcon name="upload" size={20} /> Agregar Evidencia
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
