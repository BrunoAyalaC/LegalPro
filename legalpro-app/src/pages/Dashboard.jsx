import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import AppIcon from '../components/AppIcon';
const logoImg = '/landing/assets/img/logo-icon.jpeg';


export default function Dashboard() {
  const [stats, setStats] = useState({ civiles: 0, penales: 0, total: 0, urgentes: 0 });
  const [notificaciones, setNotificaciones] = useState([]);

  useEffect(() => {
    api.getStats().then(setStats).catch(() => setStats({ civiles: 2, penales: 3, total: 5, urgentes: 1, laborales: 1, constitucionales: 1, familia: 1, activos: 3 }));
    api.getNotificaciones().then(setNotificaciones).catch(() => setNotificaciones([
      { id: 1, titulo: 'PLAZO VENCE MAÑANA', mensaje: 'Apelación Exp. 04532-2023', tipo: 'urgente' },
      { id: 2, titulo: 'Nueva Resolución', mensaje: 'Recurso de Casación admitido', tipo: 'resolucion' },
      { id: 3, titulo: 'Actualización Normativa', mensaje: 'Ley N° 31751 - Código Penal', tipo: 'info' },
    ]));
  }, []);

  const tipoColor = { urgente: 'bg-red-500', resolucion: 'bg-indigo-500', info: 'bg-slate-400' };

  const statCards = [
    { icon: 'folder_open', label: 'Civiles', value: stats.civiles + (stats.familia || 0), change: '+2 hoy' },
    { icon: 'gavel', label: 'Penales', value: stats.penales, change: '-1 hoy' },
    { icon: 'work', label: 'Laborales', value: stats.laborales || 1 },
    { icon: 'account_balance', label: 'Constitucional', value: stats.constitucionales || 1 },
  ];

  const quickLinks = [
    { to: '/analista', icon: 'analytics', title: 'Analista de Expedientes', desc: 'IA analiza tus expedientes' },
    { to: '/redactor', icon: 'edit_document', title: 'Redactor Legal IA', desc: 'Genera escritos automáticamente' },
    { to: '/simulador', icon: 'gavel', title: 'Simulador de Juicios', desc: 'Practica audiencias con IA' },
    { to: '/predictor', icon: 'trending_up', title: 'Predictor Judicial', desc: 'Predice resultados probables' },
  ];

  const institutions = [
    { icon: 'account_balance', title: 'Corte Suprema', desc: 'Casaciones y Sentencias' },
    { icon: 'balance', title: 'Tribunal Constitucional', desc: 'Precedentes vinculantes' },
    { icon: 'article', title: 'El Peruano', desc: 'Normas legales del día' },
  ];

  return (
    <div className="page-enter">

      {/* ─── HEADER ─── */}
      <header className="sticky top-0 z-40 glass px-5 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="logo-container">
              <img src={logoImg} alt="LegalPro" />
            </div>
            <div>
              <p className="text-[11px] text-slate-500 font-medium tracking-wide">Bienvenido,</p>
              <p className="text-base font-bold leading-tight gradient-text">Dr. García</p>
            </div>
          </div>
          <Link to="/notificaciones" className="w-11 h-11 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 transition-all duration-300 hover-ring relative">
            <AppIcon name="notifications" size={22} />
            {notificaciones.some(n => n.tipo === 'urgente') && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full ring-2 ring-bg-dark" style={{ animation: 'pulse-glow 1.5s ease-in-out infinite' }}></span>
            )}
          </Link>
        </div>
      </header>

      {/* ─── STAT CARDS ─── */}
      <section className="px-4 pt-6 pb-2 relative z-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold tracking-tight">Expedientes Activos</h2>
          <Link to="/expedientes" className="text-indigo-400 text-sm font-semibold hover:text-indigo-300 transition-colors">Ver todos →</Link>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {statCards.map((card, i) => (
            <div key={i}
              className={`relative overflow-hidden rounded-2xl p-4 anim-fade-in-up stagger-${i + 1}`}
              style={{
                background: i === 0 ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'var(--color-surface-dark)',
                border: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.06)',
                boxShadow: i === 0 ? '0 8px 32px rgba(99, 102, 241, 0.35)' : '0 4px 16px rgba(0,0,0,0.15)',
              }}>
              {i === 0 && <div className="absolute -top-8 -right-8 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>}
              <div className="flex items-center justify-between mb-3">
                <AppIcon name={card.icon} size={36} />
                {card.change && <span className={`text-[10px] font-semibold ${i === 0 ? 'text-white/70' : 'text-slate-500'}`}>{card.change}</span>}
              </div>
              <div className={`text-2xl font-extrabold ${i === 0 ? 'text-white' : ''}`}>{card.value}</div>
              <div className={`text-[10px] font-bold uppercase tracking-wider mt-1 ${i === 0 ? 'text-white/80' : 'text-slate-500'}`}>{card.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── SEARCH ─── */}
      <section className="px-4 py-4 anim-fade-in-up stagger-3 relative z-10">
        <Link to="/buscador" className="relative block group">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <AppIcon name="search" size={20} className="icon-muted" />
          </div>
          <div className="input pl-12 pr-14 py-4 cursor-pointer text-slate-500 group-hover:border-indigo-500/30 transition-all duration-300">
            Buscar Jurisprudencia y Normas...
          </div>
          <div className="absolute inset-y-0 right-4 flex items-center">
            <AppIcon name="auto_awesome" size={20} className="icon-indigo anim-float" />
          </div>
        </Link>
      </section>

      {/* ─── QUICK ACCESS ─── */}
      <section className="px-4 mb-6 anim-fade-in-up stagger-4 relative z-10">
        <h3 className="section-title">Accesos Rápidos</h3>
        <div className="grid grid-cols-1 gap-2.5">
          {quickLinks.map((item, i) => (
            <Link key={i} to={item.to}
              className="card-glow flex items-center gap-4 active:scale-[0.97] transition-all duration-300 group">
              <div className="icon-box bg-indigo-500/10">
                <AppIcon name={item.icon} size={26} className="icon-indigo" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[15px] group-hover:text-white transition-colors">{item.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{item.desc}</p>
              </div>
              <AppIcon name="chevron_right" size={18} className="icon-muted group-hover:translate-x-1 transition-transform duration-300" />
            </Link>
          ))}
        </div>
      </section>

      {/* ─── INSTITUTIONAL ACCESS ─── */}
      <section className="px-4 mb-6 anim-fade-in-up stagger-5 relative z-10">
        <h3 className="section-title">Accesos Institucionales</h3>
        <div className="grid grid-cols-3 gap-2.5">
          {institutions.map((item, i) => (
            <button key={i} className="card flex flex-col items-center gap-2 py-5 text-center active:scale-[0.96] transition-all duration-300 group">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <AppIcon name={item.icon} size={26} className="icon-indigo" />
              </div>
              <p className="font-bold text-[11px] leading-tight">{item.title}</p>
              <p className="text-[9px] text-slate-500 leading-snug">{item.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ─── TIMELINE ─── */}
      <section className="px-4 mb-32 relative z-10">
        <h3 className="section-title">Actualizaciones y Plazos</h3>
        <div className="space-y-0">
          {notificaciones.map((n, i) => (
            <div key={n.id} className="flex gap-4 anim-fade-in-up" style={{ animationDelay: `${i * 0.1}s`, opacity: 0 }}>
              <div className="flex flex-col items-center">
                <div className={`w-3 h-3 ${tipoColor[n.tipo] || 'bg-slate-400'} rounded-full mt-1.5 ${n.tipo === 'urgente' ? 'ring-4 ring-red-500/20 shadow-lg shadow-red-500/30' : ''}`}></div>
                {i < notificaciones.length - 1 && <div className="w-px flex-1 bg-linear-to-b from-white/10 to-transparent mt-2"></div>}
              </div>
              <div className="pb-6">
                <p className={`text-[11px] font-bold mb-1 uppercase tracking-wider ${n.tipo === 'urgente' ? 'text-red-400' : n.tipo === 'resolucion' ? 'text-indigo-400' : 'text-slate-500'}`}>
                  {n.titulo}
                </p>
                <p className="text-sm font-semibold">{n.mensaje}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
