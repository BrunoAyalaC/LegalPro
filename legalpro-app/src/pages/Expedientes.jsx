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

  useEffect(() => {
    const params = {};
    if (filtro !== 'todos') params.tipo = filtro;
    if (buscar) params.buscar = buscar;
    api.getExpedientes(params).then(data => { setExpedientes(data); setLoaded(true); }).catch(() => {
      setExpedientes([
        { id: 1, numero: '04532-2023', titulo: 'Colusión Agravada - Puente Tarata III', tipo: 'penal', estado: 'activo', prioridad: 'urgente', juzgado: '1er Juzgado Penal' },
        { id: 2, numero: '00123-2024', titulo: 'Demanda de Alimentos - Familia Rodríguez', tipo: 'familia', estado: 'en_tramite', prioridad: 'alta', juzgado: '5to Juzgado de Familia' },
        { id: 3, numero: '01120-2022', titulo: 'Amparo contra Resolución INDECOPI', tipo: 'constitucional', estado: 'activo', prioridad: 'media', juzgado: '3er Juzgado Constitucional' },
        { id: 4, numero: '02933-2023', titulo: 'Despido Arbitrario - Empresa Minera', tipo: 'laboral', estado: 'apelacion', prioridad: 'alta', juzgado: '2do Juzgado Laboral' },
        { id: 5, numero: '00042-2023', titulo: 'Delito contra el Patrimonio', tipo: 'penal', estado: 'activo', prioridad: 'media', juzgado: '1er Juzgado Penal' },
      ]);
      setLoaded(true);
    });
  }, [filtro, buscar]);

  const tipos = ['todos', 'penal', 'civil', 'laboral', 'constitucional', 'familia'];
  const tipoIcons = { penal: 'gavel', civil: 'balance', laboral: 'work', constitucional: 'account_balance', familia: 'family_restroom', administrativo: 'apartment' };
  const estadoColors = { activo: 'badge-success', en_tramite: 'badge-primary', apelacion: 'badge-warning', archivado: 'badge-danger', resuelto: 'badge-primary' };
  const prioridadColors = { urgente: 'bg-red-500', alta: 'bg-amber-500', media: 'bg-primary', baja: 'bg-slate-500' };

  const filtrados = expedientes;

  return (
    <div className="page-enter">
      <Header title="Mis Expedientes" rightAction={
        <button className="w-10 h-10 flex items-center justify-center rounded-full bg-primary text-white"><AppIcon name="add" size={20} /></button>
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
          description="No se encontraron expedientes. Agrega un nuevo caso para comenzar."
          action={
            <button className="btn btn-primary">
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
    </div>
  );
}
