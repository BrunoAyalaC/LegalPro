import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Plus, Search, Trash2, Edit2, Mail, Phone,
  MapPin, X, Building2, User, FileText, AlertTriangle,
} from 'lucide-react';
import { nodeClient } from '../api/client';

const TIPO_BADGE = {
  natural:  { bg: 'bg-cyan-500/15',    text: 'text-cyan-400',    label: 'Persona Natural' },
  juridica: { bg: 'bg-violet-500/15',  text: 'text-violet-400',  label: 'Persona Jurídica' },
};

function ClienteForm({ inicial, onGuardar, onCancelar }) {
  const [tipo, setTipo] = useState(inicial?.tipo_persona || 'natural');
  const [form, setForm] = useState({
    nombre_completo: inicial?.nombre_completo || '',
    dni: inicial?.dni || '',
    fecha_nacimiento: inicial?.fecha_nacimiento || '',
    estado_civil: inicial?.estado_civil || '',
    razon_social: inicial?.razon_social || '',
    ruc: inicial?.ruc || '',
    representante_legal: inicial?.representante_legal || '',
    email: inicial?.email || '',
    telefono: inicial?.telefono || '',
    direccion: inicial?.direccion || '',
    distrito: inicial?.distrito || '',
    provincia: inicial?.provincia || '',
    departamento: inicial?.departamento || '',
    notas: inicial?.notas || '',
  });
  const [guardando, setGuardando] = useState(false);

  const handle = (k) => (e) => setForm(s => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await onGuardar({ tipo_persona: tipo, ...form });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-2 p-1 bg-white/5 rounded-lg w-fit">
        <button
          type="button"
          onClick={() => setTipo('natural')}
          className={`px-4 py-1.5 rounded text-sm transition ${tipo === 'natural' ? 'bg-cyan-500 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          <User className="w-3.5 h-3.5 inline mr-1.5" /> Persona Natural
        </button>
        <button
          type="button"
          onClick={() => setTipo('juridica')}
          className={`px-4 py-1.5 rounded text-sm transition ${tipo === 'juridica' ? 'bg-violet-500 text-white' : 'text-slate-400 hover:text-white'}`}
        >
          <Building2 className="w-3.5 h-3.5 inline mr-1.5" /> Persona Jurídica
        </button>
      </div>

      {tipo === 'natural' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo label="Nombre completo *" value={form.nombre_completo} onChange={handle('nombre_completo')} required />
          <Campo label="DNI" value={form.dni} onChange={handle('dni')} maxLength={8} pattern="[0-9]{8}" />
          <Campo label="Fecha de nacimiento" type="date" value={form.fecha_nacimiento} onChange={handle('fecha_nacimiento')} />
          <Select label="Estado civil" value={form.estado_civil} onChange={handle('estado_civil')}>
            <option value="">—</option>
            <option value="soltero">Soltero(a)</option>
            <option value="casado">Casado(a)</option>
            <option value="divorciado">Divorciado(a)</option>
            <option value="viudo">Viudo(a)</option>
            <option value="conviviente">Conviviente</option>
          </Select>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Campo label="Razón social *" value={form.razon_social} onChange={handle('razon_social')} required />
          <Campo label="RUC" value={form.ruc} onChange={handle('ruc')} maxLength={11} pattern="[0-9]{11}" />
          <Campo label="Representante legal" value={form.representante_legal} onChange={handle('representante_legal')} />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Campo label="Email" type="email" value={form.email} onChange={handle('email')} />
        <Campo label="Teléfono" value={form.telefono} onChange={handle('telefono')} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Campo label="Dirección" value={form.direccion} onChange={handle('direccion')} className="sm:col-span-3" />
        <Campo label="Distrito" value={form.distrito} onChange={handle('distrito')} />
        <Campo label="Provincia" value={form.provincia} onChange={handle('provincia')} />
        <Campo label="Departamento" value={form.departamento} onChange={handle('departamento')} />
      </div>

      <div>
        <label className="block text-xs text-slate-400 mb-1">Notas</label>
        <textarea
          value={form.notas}
          onChange={handle('notas')}
          rows={3}
          className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white"
        />
      </div>

      <div className="flex gap-2 justify-end pt-2">
        <button type="button" onClick={onCancelar} className="px-4 py-2 text-sm text-slate-400 hover:text-white">
          Cancelar
        </button>
        <button
          type="submit"
          disabled={guardando}
          className="px-4 py-2 text-sm bg-cyan-500 hover:bg-cyan-400 text-white rounded disabled:opacity-50"
        >
          {guardando ? 'Guardando…' : (inicial ? 'Actualizar' : 'Crear cliente')}
        </button>
      </div>
    </form>
  );
}

function Campo({ label, className = '', ...props }) {
  return (
    <div className={className}>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <input
        {...props}
        onChange={props.onChange}
        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white"
      />
    </div>
  );
}

function Select({ label, children, ...props }) {
  return (
    <div>
      <label className="block text-xs text-slate-400 mb-1">{label}</label>
      <select
        {...props}
        className="w-full bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white"
      >
        {children}
      </select>
    </div>
  );
}

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filtroTipo, setFiltroTipo] = useState('todos');
  const [modal, setModal] = useState(null); // {tipo: 'crear'|'editar', cliente?: object}

  const cargar = async () => {
    try {
      setLoading(true);
      const res = await nodeClient.get('/api/clientes');
      const items = res.data?.data || res.data || [];
      setClientes(Array.isArray(items) ? items : []);
      setError(null);
    } catch (e) {
      setError(e.message || 'Error al cargar clientes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { cargar(); }, []);

  const filtrados = useMemo(() => {
    return clientes
      .filter(c => filtroTipo === 'todos' || c.tipo_persona === filtroTipo)
      .filter(c => {
        if (!search) return true;
        const q = search.toLowerCase();
        return (c.nombre_completo || '').toLowerCase().includes(q)
          || (c.razon_social || '').toLowerCase().includes(q)
          || (c.dni || '').includes(q)
          || (c.ruc || '').includes(q);
      });
  }, [clientes, search, filtroTipo]);

  const guardar = async (data) => {
    try {
      if (modal?.tipo === 'editar') {
        await nodeClient.put(`/api/clientes/${modal.cliente.id}`, data);
      } else {
        await nodeClient.post('/api/clientes', data);
      }
      setModal(null);
      await cargar();
    } catch (e) {
      alert('Error al guardar: ' + (e.response?.data?.error || e.message));
    }
  };

  const eliminar = async (id) => {
    if (!confirm('¿Eliminar este cliente? (soft-delete, se puede recuperar)')) return;
    try {
      await nodeClient.delete(`/api/clientes/${id}`);
      await cargar();
    } catch (e) {
      alert('Error al eliminar: ' + (e.response?.data?.error || e.message));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-cyan-400" />
            Clientes
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Gestión de clientes del estudio (demandantes, demandados, terceros).
          </p>
        </div>
        <button
          onClick={() => setModal({ tipo: 'crear' })}
          className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-white rounded-lg flex items-center gap-2 text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Nuevo cliente
        </button>
      </div>

      <div className="flex flex-wrap gap-3 items-center bg-white/5 rounded-lg p-3 border border-white/10">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nombre, DNI, RUC..."
            className="w-full pl-10 pr-3 py-2 bg-white/5 border border-white/10 rounded text-sm text-white"
          />
        </div>
        <select
          value={filtroTipo}
          onChange={e => setFiltroTipo(e.target.value)}
          className="bg-white/5 border border-white/10 rounded px-3 py-2 text-sm text-white"
        >
          <option value="todos">Todos</option>
          <option value="natural">Personas naturales</option>
          <option value="juridica">Personas jurídicas</option>
        </select>
        <span className="text-xs text-slate-500 ml-auto">{filtrados.length} clientes</span>
      </div>

      {loading && <div className="text-center py-12 text-slate-400">Cargando clientes…</div>}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 mt-0.5" />
          <div>
            <div className="font-medium">No se pudo conectar al backend</div>
            <div className="text-sm opacity-80">{error}</div>
            <div className="text-xs mt-2 opacity-70">Verifica que el endpoint /api/clientes esté desplegado.</div>
          </div>
        </div>
      )}
      {!loading && !error && filtrados.length === 0 && (
        <div className="text-center py-16 text-slate-500 bg-white/5 rounded-xl border border-white/10">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No hay clientes {search && `que coincidan con "${search}"`}.</p>
          <button onClick={() => setModal({ tipo: 'crear' })} className="mt-3 text-sm text-cyan-400 hover:text-cyan-300">
            Crear el primero
          </button>
        </div>
      )}
      {!loading && !error && filtrados.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtrados.map((c, i) => {
            const badge = TIPO_BADGE[c.tipo_persona] || TIPO_BADGE.natural;
            const nombre = c.tipo_persona === 'juridica' ? c.razon_social : c.nombre_completo;
            const doc = c.tipo_persona === 'juridica' ? c.ruc : c.dni;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
                className="bg-white/5 rounded-xl border border-white/10 p-4 hover:border-cyan-500/30 transition"
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs ${badge.bg} ${badge.text} mb-1.5`}>
                      {c.tipo_persona === 'juridica' ? <Building2 className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {badge.label}
                    </div>
                    <div className="text-white font-medium truncate">{nombre || '(sin nombre)'}</div>
                    {doc && <div className="text-xs text-slate-500">{c.tipo_persona === 'juridica' ? 'RUC' : 'DNI'}: {doc}</div>}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setModal({ tipo: 'editar', cliente: c })}
                      className="p-1.5 hover:bg-white/10 rounded"
                      title="Editar"
                    >
                      <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                    <button
                      onClick={() => eliminar(c.id)}
                      className="p-1.5 hover:bg-red-500/20 rounded"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  </div>
                </div>
                <div className="space-y-1 text-xs text-slate-400">
                  {c.email && <div className="flex items-center gap-1.5"><Mail className="w-3 h-3" /> {c.email}</div>}
                  {c.telefono && <div className="flex items-center gap-1.5"><Phone className="w-3 h-3" /> {c.telefono}</div>}
                  {(c.distrito || c.departamento) && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3 h-3" />
                      {[c.distrito, c.provincia, c.departamento].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-white/10 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">
                {modal.tipo === 'editar' ? 'Editar cliente' : 'Nuevo cliente'}
              </h2>
              <button onClick={() => setModal(null)} className="p-1 hover:bg-white/10 rounded">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 py-4">
              <ClienteForm
                inicial={modal.cliente}
                onGuardar={guardar}
                onCancelar={() => setModal(null)}
              />
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}