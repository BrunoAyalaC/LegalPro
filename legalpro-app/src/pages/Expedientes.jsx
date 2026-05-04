import { useState, useEffect } from 'react';
import AppIcon from '../components/AppIcon';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import EmptyState from '../components/EmptyState';
import api from '../api/client';
import sinExpedientesImg from '../assets/empty-states/sin_expedientes.png';

export default function Expedientes() {
  const [expedientes, setExpedientes] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [buscar, setBuscar] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    numero: '',
    titulo: '',
    tipo: 'penal',
    juzgado: '',
    estado: 'activo',
    prioridad: 'media',
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitLoading, setSubmitLoading] = useState(false);

  const cargarExpedientes = () => {
    setFetchError('');
    const params = {};
    if (filtro !== 'todos') params.tipo = filtro;
    if (buscar) params.buscar = buscar;
    api.getExpedientes(params)
      .then(data => { setExpedientes(data); setLoaded(true); })
      .catch(() => {
        setExpedientes([]);
        setFetchError('No se pudieron cargar los expedientes. Intenta de nuevo más tarde.');
        setLoaded(true);
      });
  };

  useEffect(() => {
    cargarExpedientes();
  }, [filtro, buscar]);

  const tipos = ['todos', 'penal', 'civil', 'laboral', 'constitucional', 'familia'];
  const tipoIcons = { penal: 'gavel', civil: 'balance', laboral: 'work', constitucional: 'account_balance', familia: 'family_restroom', administrativo: 'apartment' };
  const estadoColors = { activo: 'badge-success', en_tramite: 'badge-primary', apelacion: 'badge-warning', archivado: 'badge-danger', resuelto: 'badge-primary' };
  const prioridadColors = { urgente: 'bg-red-500', alta: 'bg-amber-500', media: 'bg-primary', baja: 'bg-slate-500' };

  const validate = () => {
    const errors = {};
    if (!formData.numero.trim()) errors.numero = 'El número de expediente es obligatorio.';
    if (!formData.titulo.trim()) errors.titulo = 'El título es obligatorio.';
    if (!formData.juzgado.trim()) errors.juzgado = 'El juzgado es obligatorio.';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (formErrors[name]) setFormErrors(prev => ({ ...prev, [name]: '' }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitLoading(true);
    setFormErrors(prev => ({ ...prev, general: '' }));
    try {
      await api.createExpediente(formData);
      setShowModal(false);
      setFormData({ numero: '', titulo: '', tipo: 'penal', juzgado: '', estado: 'activo', prioridad: 'media' });
      cargarExpedientes();
    } catch {
      setFormErrors(prev => ({ ...prev, general: 'Error al crear el expediente. Intenta de nuevo.' }));
    } finally {
      setSubmitLoading(false);
    }
  };

  const filtrados = expedientes;

  return (
    <div className="page-enter">
      <Header title="Mis Expedientes" rightAction={
        <button onClick={() => setShowModal(true)} className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-white"><AppIcon name="add" size={20} /></button>
      } />

      {/* Search */}
      <div className="px-4 py-3">
        <div className="relative">
          <AppIcon name="search" size={20} />
          <input value={buscar} onChange={e => setBuscar(e.target.value)} className="input pl-10" placeholder="Buscar por N° o título..." />
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 px-4 pb-3 overflow-x-auto no-scrollbar">
        {tipos.map(t => (
          <button key={t} onClick={() => setFiltro(t)}
            className={`whitespace-nowrap px-4 py-2 rounded-full text-xs font-semibold border transition-colors ${filtro === t ? 'bg-primary/20 text-primary border-primary/30' : 'bg-surface-dark text-slate-400 border-border-dark'}`}>
            {t === 'todos' ? 'Todos' : t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {fetchError && (
        <div className="px-4 mb-3">
          <div className="card border-l-4 border-red-500 bg-red-500/10 p-3 text-sm text-red-200">
            {fetchError}
          </div>
        </div>
      )}

      {filtrados.length > 0 && (
        <div className="px-4 flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Resultados ({filtrados.length})</span>
        </div>
      )}

      {/* Case List or Empty State */}
      {loaded && filtrados.length === 0 ? (
        <EmptyState
          image={sinExpedientesImg}
          title="Sin expedientes"
          description="No tienes expedientes registrados. Crea tu primer caso para comenzar."
          action={
            <button onClick={() => setShowModal(true)} className="btn btn-primary">
              <AppIcon name="add" size={20} /> Nuevo Expediente
            </button>
          }
        />
      ) : (
        <div className="px-4 space-y-3">
          {filtrados.map((exp, i) => (
            <Link key={exp.id} to={`/expediente/${exp.id}`}
              className="card flex gap-3 items-start active:scale-[0.98] transition-transform anim-fade-in-up"
              style={{ animationDelay: `${i * 0.05}s`, opacity: 0 }}>
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <AppIcon name={tipoIcons[exp.tipo] || 'folder'} size={28} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`badge ${estadoColors[exp.estado] || 'badge-primary'}`}>{exp.estado?.replace('_', ' ')}</span>
                  <div className={`w-2 h-2 rounded-full ${prioridadColors[exp.prioridad] || 'bg-slate-500'}`}></div>
                </div>
                <p className="font-bold text-sm leading-tight truncate">{exp.titulo}</p>
                <p className="text-xs text-slate-500 mt-0.5">Exp. {exp.numero} • {exp.juzgado}</p>
              </div>
              <AppIcon name="chevron_right" size={20} />
            </Link>
          ))}
        </div>
      )}

      {/* Modal Nuevo Expediente */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[#0f0f16] border border-border-dark rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-dark">
              <h2 className="text-base font-bold text-white">Nuevo Expediente</h2>
              <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400">
                <AppIcon name="close" size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              {formErrors.general && (
                <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                  {formErrors.general}
                </div>
              )}
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Número <span className="text-red-400">*</span></label>
                <input name="numero" value={formData.numero} onChange={handleChange} className={`input w-full ${formErrors.numero ? 'border-red-500' : ''}`} placeholder="Ej: 04532-2023" />
                {formErrors.numero && <p className="text-xs text-red-400 mt-1">{formErrors.numero}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Título <span className="text-red-400">*</span></label>
                <input name="titulo" value={formData.titulo} onChange={handleChange} className={`input w-full ${formErrors.titulo ? 'border-red-500' : ''}`} placeholder="Ej: Colusión Agravada" />
                {formErrors.titulo && <p className="text-xs text-red-400 mt-1">{formErrors.titulo}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tipo</label>
                <select name="tipo" value={formData.tipo} onChange={handleChange} className="input w-full bg-transparent">
                  <option value="penal">Penal</option>
                  <option value="civil">Civil</option>
                  <option value="laboral">Laboral</option>
                  <option value="constitucional">Constitucional</option>
                  <option value="familia">Familia</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Juzgado <span className="text-red-400">*</span></label>
                <input name="juzgado" value={formData.juzgado} onChange={handleChange} className={`input w-full ${formErrors.juzgado ? 'border-red-500' : ''}`} placeholder="Ej: 1er Juzgado Penal" />
                {formErrors.juzgado && <p className="text-xs text-red-400 mt-1">{formErrors.juzgado}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Estado</label>
                  <select name="estado" value={formData.estado} onChange={handleChange} className="input w-full bg-transparent">
                    <option value="activo">Activo</option>
                    <option value="en_tramite">En trámite</option>
                    <option value="apelacion">Apelación</option>
                    <option value="archivado">Archivado</option>
                    <option value="resuelto">Resuelto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Prioridad</label>
                  <select name="prioridad" value={formData.prioridad} onChange={handleChange} className="input w-full bg-transparent">
                    <option value="urgente">Urgente</option>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 btn bg-surface-dark border border-border-dark text-slate-300 hover:bg-white/5">
                  Cancelar
                </button>
                <button type="submit" disabled={submitLoading} className="flex-1 btn btn-primary disabled:opacity-50">
                  {submitLoading ? 'Creando...' : 'Crear Expediente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
