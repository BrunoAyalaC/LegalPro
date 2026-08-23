import { useState, useEffect } from 'react';
import AppIcon from '../components/AppIcon';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import EmptyState from '../components/EmptyState';
import { nodeClient } from '../api/client';
import { exportToExcel } from '../utils/documents';
import sinExpedientesImg from '../assets/empty-states/sin_expedientes.png';
import sinExpedientesWebp from '../assets/empty-states/sin_expedientes.webp';
import { useSeo } from '../hooks/useSeo';

const PAGE_SIZE = 10;

export default function Expedientes() {
  const [expedientes, setExpedientes] = useState([]);
  const [filtro, setFiltro] = useState('todos');
  const [buscar, setBuscar] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [page, setPage] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);         // null=crear, string=editar
  const [exportLoading, setExportLoading] = useState(false);
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

  const [totalExp, setTotalExp] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const cargarExpedientes = (signal) => {
    setFetchError('');
    const params = { page, pageSize: PAGE_SIZE };
    if (filtro !== 'todos') params.tipo = filtro;
    if (buscar) params.buscar = buscar;
    nodeClient
      .get('/api/expedientes', { params, signal })
      .then(res => {
        const data = res.data?.data ?? res.data;
        const items = Array.isArray(data)
          ? data
          : Array.isArray(data?.expedientes)
            ? data.expedientes
            : [];
        setExpedientes(items);
        setTotalExp(data?.total ?? data?.totalCount ?? items.length);
        setTotalPages(data?.totalPages ?? Math.max(1, Math.ceil((data?.total ?? items.length) / PAGE_SIZE)));
        setLoaded(true);
      })
      .catch((err) => {
        if (err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') return;
        setExpedientes([]);
        setFetchError('No se pudieron cargar los expedientes. Intenta de nuevo más tarde.');
        setLoaded(true);
      });
  };

  useEffect(() => {
    const controller = new AbortController();
    cargarExpedientes(controller.signal);
    return () => controller.abort();
  }, [filtro, buscar, page]);

  useEffect(() => {
    setPage(1);
  }, [filtro, buscar]);

  useSeo({
    title: 'Mis Expedientes Judiciales | LegalPro',
    description: 'Administra y organiza tus expedientes judiciales. Filtra por materias, controla plazos y prioridades, y accede a herramientas de IA.',
  });

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
      if (editingId) {
        await nodeClient.patch(`/api/expedientes/${editingId}`, formData);
      } else {
        await nodeClient.post('/api/expedientes', formData);
      }
      setShowModal(false);
      setEditingId(null);
      setFormData({ numero: '', titulo: '', tipo: 'penal', juzgado: '', estado: 'activo', prioridad: 'media' });
      cargarExpedientes();
    } catch (err) {
      const msg = err?.response?.data?.error || (editingId ? 'Error al actualizar el expediente. Intenta de nuevo.' : 'Error al crear el expediente. Intenta de nuevo.');
      setFormErrors(prev => ({ ...prev, general: msg }));
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleEditClick = (exp) => {
    setEditingId(exp.id);
    setFormData({
      numero: exp.numero || '',
      titulo: exp.titulo || '',
      tipo: exp.tipo || 'penal',
      juzgado: exp.juzgado || '',
      estado: exp.estado || 'activo',
      prioridad: exp.prioridad || 'media',
    });
    setFormErrors({});
    setShowModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    try {
      await nodeClient.delete(`/api/expedientes/${deleteTarget.id}`);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
      if (page > 1 && expedientes.length === 1) {
        setPage(p => p - 1);
      } else {
        cargarExpedientes();
      }
    } catch (err) {
      const msg = err?.response?.data?.error || 'Error al eliminar el expediente. Intenta de nuevo.';
      setFetchError(msg);
      setShowDeleteConfirm(false);
      setDeleteTarget(null);
    } finally {
      setDeleteLoading(false);
    }
  };

  const filtrados = expedientes;
  const safePage = Math.min(page, totalPages);

  return (
    <div className="page-enter">
      <Header title="Mis Expedientes" rightAction={
        <div className="flex items-center gap-2">
          <button 
            id="btn-exportar-expedientes-excel"
            onClick={async () => {
              if (!filtrados.length) return;
              setExportLoading(true);
              try {
                const today = new Date().toISOString().split('T')[0];
                const data = filtrados.map(e => ({
                  'Número': e.numero,
                  'Título': e.titulo,
                  'Tipo': e.tipo,
                  'Estado': e.estado?.replace('_', ' '),
                  'Prioridad': e.prioridad,
                  'Juzgado': e.juzgado
                }));
                await exportToExcel(data, `Expedientes_${today}.xlsx`, ['Número', 'Título', 'Tipo', 'Estado', 'Prioridad', 'Juzgado']);
              } catch {
                setFetchError('Error al exportar a Excel. Intenta de nuevo.');
              } finally {
                setExportLoading(false);
              }
            }}
            disabled={exportLoading || !filtrados.length}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-surface-dark border border-border-dark text-slate-300 hover:bg-white/5 disabled:opacity-50"
            title="Exportar a Excel"
          >
            {exportLoading ? (
              <span className="inline-block w-4 h-4 rounded-full border-2 border-slate-400 border-t-transparent animate-spin" />
            ) : (
              <AppIcon name="table_chart" size={18} />
            )}
          </button>
          <button id="btn-nuevo-expediente-header" onClick={() => setShowModal(true)} className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-white"><AppIcon name="add" size={20} /></button>
        </div>
      } />

      {/* Search */}
      <div className="px-4 py-3 max-w-5xl mx-auto w-full">
        <div className="relative">
          <AppIcon name="search" size={20} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-60" />
          <input id="input-buscar-expediente" value={buscar} onChange={e => setBuscar(e.target.value)} className="input pl-10 w-full" placeholder="Buscar por N° o título..." />
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex gap-2 px-4 pb-3 max-w-5xl mx-auto w-full overflow-x-auto no-scrollbar">
        {tipos.map(t => (
          <button key={t} id={`btn-filtro-tipo-${t}`} onClick={() => setFiltro(t)}
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
          <span className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Resultados ({totalExp})</span>
        </div>
      )}

      {/* Case List or Empty State */}
      {loaded && filtrados.length === 0 ? (
        <EmptyState
          image={sinExpedientesImg}
          imageWebp={sinExpedientesWebp}
          title="Sin expedientes"
          description="No tienes expedientes registrados. Crea tu primer caso para comenzar."
          action={
            <button id="btn-nuevo-expediente-empty" onClick={() => setShowModal(true)} className="btn btn-primary">
              <AppIcon name="add" size={20} /> Nuevo Expediente
            </button>
          }
        />
      ) : (
        <div className="px-4 space-y-3 pb-24 lg:pb-6 max-w-5xl mx-auto w-full">
          {filtrados.map((exp, i) => (
            <div key={exp.id}
              className="expediente-row card flex flex-row gap-3 items-center py-3 anim-fade-in-up group"
              style={{ animationDelay: `${i * 0.05}s` }}>
              <Link to={`/expediente/${exp.id}`}
                id={`link-expediente-${exp.id}`}
                className="flex gap-3 items-start flex-1 min-w-0 active:scale-[0.98] transition-transform">
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
              </Link>
              <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  id={`btn-editar-expediente-${exp.id}`}
                  onClick={(e) => { e.preventDefault(); handleEditClick(exp); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/20 transition-colors"
                  title="Editar expediente"
                >
                  <AppIcon name="edit" size={15} />
                </button>
                <button
                  id={`btn-eliminar-expediente-${exp.id}`}
                  onClick={(e) => { e.preventDefault(); setDeleteTarget(exp); setShowDeleteConfirm(true); }}
                  className="w-8 h-8 flex items-center justify-center rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors"
                  title="Eliminar expediente"
                >
                  <AppIcon name="delete" size={15} />
                </button>
              </div>
              <AppIcon name="chevron_right" size={20} className="text-slate-500 shrink-0" />
            </div>
          ))}

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 pb-6">
              <button
                id="btn-pagina-anterior"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-dark border border-border-dark text-sm text-slate-300 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                <AppIcon name="chevron_left" size={16} />
                Anterior
              </button>

              <span className="text-xs text-slate-500 font-medium">
                Página {safePage} de {totalPages}
                <span className="ml-2 text-slate-600">({totalExp} resultados)</span>
              </span>

              <button
                id="btn-pagina-siguiente"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-dark border border-border-dark text-sm text-slate-300 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
              >
                Siguiente
                <AppIcon name="chevron_right" size={16} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal de Confirmación de Eliminación */}
      {showDeleteConfirm && deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[#0f0f16] border border-red-500/20 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="px-5 py-4 border-b border-border-dark">
              <h2 className="text-base font-bold text-white">Eliminar Expediente</h2>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-300 leading-relaxed">
                ¿Estás seguro de eliminar el expediente <strong className="text-white">{deleteTarget.titulo}</strong> (Exp. {deleteTarget.numero})?
              </p>
              <ul className="text-xs text-slate-400 list-disc pl-4 space-y-1">
                <li>Esta acción no se puede deshacer.</li>
                <li>Se eliminarán todos los documentos y datos asociados.</li>
              </ul>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => { setShowDeleteConfirm(false); setDeleteTarget(null); }}
                  disabled={deleteLoading}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 text-slate-300 text-xs font-bold border border-white/10 hover:bg-white/10 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  disabled={deleteLoading}
                  className="flex-1 py-2.5 rounded-xl bg-red-500/15 text-red-400 text-xs font-bold border border-red-500/25 hover:bg-red-500/25 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deleteLoading ? (
                    <><span className="inline-block w-4 h-4 rounded-full border-2 border-red-400/30 border-t-red-400 animate-spin" /> Eliminando...</>
                  ) : 'Sí, eliminar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Nuevo Expediente */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="bg-[#0f0f16] border border-border-dark rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border-dark">
              <h2 className="text-base font-bold text-white">{editingId ? 'Editar Expediente' : 'Nuevo Expediente'}</h2>
              <button id="btn-cerrar-modal" onClick={() => { setShowModal(false); setEditingId(null); }} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-white/10 text-slate-400">
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
                <input id="input-form-numero" name="numero" value={formData.numero} onChange={handleChange} className={`input w-full ${formErrors.numero ? 'border-red-500' : ''}`} placeholder="Ej: 04532-2023" />
                {formErrors.numero && <p className="text-xs text-red-400 mt-1">{formErrors.numero}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Título <span className="text-red-400">*</span></label>
                <input id="input-form-titulo" name="titulo" value={formData.titulo} onChange={handleChange} className={`input w-full ${formErrors.titulo ? 'border-red-500' : ''}`} placeholder="Ej: Colusión Agravada" />
                {formErrors.titulo && <p className="text-xs text-red-400 mt-1">{formErrors.titulo}</p>}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Tipo</label>
                <select id="select-form-tipo" name="tipo" value={formData.tipo} onChange={handleChange} className="input w-full bg-transparent">
                  <option value="penal">Penal</option>
                  <option value="civil">Civil</option>
                  <option value="laboral">Laboral</option>
                  <option value="constitucional">Constitucional</option>
                  <option value="familia">Familia</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Juzgado <span className="text-red-400">*</span></label>
                <input id="input-form-juzgado" name="juzgado" value={formData.juzgado} onChange={handleChange} className={`input w-full ${formErrors.juzgado ? 'border-red-500' : ''}`} placeholder="Ej: 1er Juzgado Penal" />
                {formErrors.juzgado && <p className="text-xs text-red-400 mt-1">{formErrors.juzgado}</p>}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Estado</label>
                  <select id="select-form-estado" name="estado" value={formData.estado} onChange={handleChange} className="input w-full bg-transparent">
                    <option value="activo">Activo</option>
                    <option value="en_tramite">En trámite</option>
                    <option value="apelacion">Apelación</option>
                    <option value="archivado">Archivado</option>
                    <option value="resuelto">Resuelto</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Prioridad</label>
                  <select id="select-form-prioridad" name="prioridad" value={formData.prioridad} onChange={handleChange} className="input w-full bg-transparent">
                    <option value="urgente">Urgente</option>
                    <option value="alta">Alta</option>
                    <option value="media">Media</option>
                    <option value="baja">Baja</option>
                  </select>
                </div>
              </div>
              <div className="pt-2 flex gap-3">
                <button id="btn-cancelar-creacion" type="button" onClick={() => { setShowModal(false); setEditingId(null); }} className="flex-1 btn bg-surface-dark border border-border-dark text-slate-300 hover:bg-white/5">
                  Cancelar
                </button>
                <button id="btn-submit-creacion" type="submit" disabled={submitLoading} className="flex-1 btn btn-primary disabled:opacity-50">
                  {submitLoading
                    ? (editingId ? 'Guardando...' : 'Creando...')
                    : (editingId ? 'Guardar Cambios' : 'Crear Expediente')
                  }
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
