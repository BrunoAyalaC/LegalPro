import { useState, useEffect } from 'react';
import Header from '../components/Header';
import AppIcon from '../components/AppIcon';
import { api } from '../api/client';

export default function GestionMultidoc() {
  const [expediente, setExpediente] = useState(null);
  const [documentos, setDocumentos] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [nuevoContenido, setNuevoContenido] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const cargar = async () => {
      try {
        const exp = await api.getExpediente?.();
        if (exp) {
          setExpediente(exp);
          const docs = await api.getDocumentos?.(exp.id);
          if (docs) setDocumentos(docs);
        }
      } catch {
        // Sin expediente: estado vacío
      }
    };
    cargar();
  }, []);

  const handleCrear = async () => {
    if (!nuevoTitulo.trim() || !expediente) return;
    setLoading(true);
    setError('');
    try {
      const doc = await api.createDocumento?.({
        titulo: nuevoTitulo,
        contenido: nuevoContenido,
        expediente_id: expediente.id,
      });
      if (doc) {
        setDocumentos(prev => [...prev, doc]);
        setNuevoTitulo('');
        setNuevoContenido('');
        setShowForm(false);
      }
    } catch {
      setError('Error al crear el documento');
    } finally {
      setLoading(false);
    }
  };

  if (!expediente) {
    return (
      <div className="page-enter">
        <Header title="Expediente Multidoc" showBack rightAction={<AppIcon name="folder_copy" size={20} />} />
        <div className="px-4 py-12 text-center text-slate-400">
          <AppIcon name="folder_open" size={40} className="mx-auto mb-4 opacity-50" />
          <p className="text-sm">Selecciona un expediente para ver sus documentos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-enter">
      <Header title="Expediente Multidoc" showBack rightAction={<AppIcon name="folder_copy" size={20} />} />
      <div className="px-4 py-6 space-y-6">
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center"><AppIcon name="folder_open" size={20} /></div>
            <div>
              <p className="font-bold text-sm">{expediente.numero ?? 'Sin número'}</p>
              <p className="text-xs text-slate-400">{documentos.length} documentos</p>
            </div>
          </div>
        </div>

        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider">Documentos del Expediente</h3>

        {documentos.length === 0 && (
          <p className="text-xs text-slate-500">No hay documentos registrados.</p>
        )}

        {documentos.map((d, i) => (
          <div key={d.id ?? i} className="card flex items-center gap-3 anim-fade-in-up" style={{ animationDelay: `${i * 0.08}s`, opacity: 0 }}>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><AppIcon name="description" size={20} /></div>
            <div className="flex-1">
              <p className="font-semibold text-sm">{d.titulo ?? d.name ?? 'Sin título'}</p>
              <p className="text-[10px] text-slate-500">{d.paginas ?? d.pages ?? '-'} páginas • {d.tipo ?? 'documento'}</p>
            </div>
            <AppIcon name="more_vert" size={20} />
          </div>
        ))}

        {showForm && (
          <div className="card space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">Nuevo Documento</h4>
            <label className="block">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Título</span>
              <input
                className="input"
                placeholder="Título del documento"
                value={nuevoTitulo}
                onChange={e => setNuevoTitulo(e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-1 block">Contenido</span>
              <textarea
                className="input min-h-[80px] resize-none"
                placeholder="Contenido o descripción..."
                value={nuevoContenido}
                onChange={e => setNuevoContenido(e.target.value)}
              />
            </label>
            {error && <p className="text-red-400 text-xs">{error}</p>}
            <div className="flex gap-2">
              <button className="btn btn-secondary flex-1 text-xs" onClick={() => setShowForm(false)}>Cancelar</button>
              <button className="btn btn-primary flex-1 text-xs" onClick={handleCrear} disabled={loading || !nuevoTitulo.trim()}>
                {loading ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        )}

        {!showForm && (
          <button className="btn btn-primary w-full" onClick={() => setShowForm(true)}>
            <AppIcon name="note_add" size={20} /> Agregar Documento
          </button>
        )}
      </div>
    </div>
  );
}
