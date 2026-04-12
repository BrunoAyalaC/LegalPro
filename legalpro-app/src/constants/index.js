/* ═══════════════════════════════════════════════════════════
   CONSTANTES GLOBALES — LegalPro
   Fuente única de verdad para roles, materias, estados, etc.
═══════════════════════════════════════════════════════════ */

/* ── Roles del sistema ─────────────────────────────────────── */
export const ROLES = {
  ABOGADO:  'ABOGADO',
  FISCAL:   'FISCAL',
  JUEZ:     'JUEZ',
  CONTADOR: 'CONTADOR',
};

export const ROL_LABELS = {
  ABOGADO:  'Abogado Litigante',
  FISCAL:   'Fiscal',
  JUEZ:     'Magistrado',
  CONTADOR: 'Perito Contable',
};

export const ROL_COLORS = {
  ABOGADO:  'blue',
  FISCAL:   'violet',
  JUEZ:     'amber',
  CONTADOR: 'emerald',
};

/* ── Materias legales ──────────────────────────────────────── */
export const MATERIAS = [
  { value: 'PENAL',          label: 'Penal',           color: 'red'     },
  { value: 'CIVIL',          label: 'Civil',           color: 'blue'    },
  { value: 'LABORAL',        label: 'Laboral',         color: 'amber'   },
  { value: 'CONSTITUCIONAL', label: 'Constitucional',  color: 'violet'  },
  { value: 'FAMILIA',        label: 'Familia',         color: 'pink'    },
  { value: 'ADMINISTRATIVO', label: 'Administrativo',  color: 'cyan'    },
  { value: 'COMERCIAL',      label: 'Comercial',       color: 'emerald' },
  { value: 'TRIBUTARIO',     label: 'Tributario',      color: 'orange'  },
];

/* ── Estados de expedientes ────────────────────────────────── */
export const EXPEDIENTE_STATUS = {
  ACTIVO:    'ACTIVO',
  PENDIENTE: 'PENDIENTE',
  URGENTE:   'URGENTE',
  ARCHIVADO: 'ARCHIVADO',
  RESUELTO:  'RESUELTO',
};

export const STATUS_LABELS = {
  ACTIVO:    'Activo',
  PENDIENTE: 'Pendiente',
  URGENTE:   'Urgente',
  ARCHIVADO: 'Archivado',
  RESUELTO:  'Resuelto',
};

export const STATUS_VARIANTS = {
  ACTIVO:    'activo',
  PENDIENTE: 'pendiente',
  URGENTE:   'urgente',
  ARCHIVADO: 'archivado',
  RESUELTO:  'success',
};

/* ── Instancias judiciales ─────────────────────────────────── */
export const INSTANCIAS = [
  { group: 'Primera Instancia', items: [
    'Juzgado de Paz Letrado',
    'Juzgado Especializado Civil',
    'Juzgado Especializado Penal',
    'Juzgado Especializado Laboral',
    'Juzgado Especializado Familia',
  ]},
  { group: 'Segunda Instancia', items: [
    'Sala Civil',
    'Sala Penal',
    'Sala Laboral',
    'Sala Mixta',
  ]},
  { group: 'Corte Suprema', items: [
    'Sala Civil Permanente',
    'Sala Civil Transitoria',
    'Sala Penal Permanente',
    'Sala Penal Especial',
    'Sala Constitucional y Social',
  ]},
  { group: 'Tribunal Constitucional', items: [
    'Primer Pleno',
    'Segundo Pleno',
    'Pleno del TC',
  ]},
];

/* ── Tipos de escrito legal ────────────────────────────────── */
export const TIPOS_ESCRITO = [
  { value: 'DEMANDA',              label: 'Demanda' },
  { value: 'CONTESTACION',         label: 'Contestación de demanda' },
  { value: 'APELACION',            label: 'Apelación' },
  { value: 'CASACION',             label: 'Casación' },
  { value: 'RECURSO_AMPARO',       label: 'Recurso de Amparo' },
  { value: 'HABEAS_CORPUS',        label: 'Hábeas Corpus' },
  { value: 'MEDIDA_CAUTELAR',      label: 'Medida Cautelar' },
  { value: 'ESCRITO_SIMPLE',       label: 'Escrito Simple' },
  { value: 'REQUERIMIENTO',        label: 'Requerimiento Fiscal' },
  { value: 'ACUSACION',            label: 'Acusación Fiscal' },
  { value: 'SOBRESEIMIENTO',       label: 'Sobreseimiento' },
  { value: 'INFORME_PERICIAL',     label: 'Informe Pericial' },
  { value: 'ALEGATO_CLAUSURA',     label: 'Alegato de Clausura' },
];

/* ── Tipos de evento en timeline ───────────────────────────── */
export const TIMELINE_EVENT_TYPES = [
  'creacion',
  'escrito',
  'audiencia',
  'resolucion',
  'notificacion',
  'documento',
];

/* ── Planes de suscripción ─────────────────────────────────── */
export const PLANES = {
  FREE:       { label: 'Gratuito',    color: 'slate',   expedientes: 5,   ia: 10  },
  PRO:        { label: 'Pro',         color: 'blue',    expedientes: 100, ia: 500 },
  ENTERPRISE: { label: 'Enterprise',  color: 'amber',   expedientes: -1,  ia: -1  },
};

/* ── Fuentes de jurisprudencia ─────────────────────────────── */
export const FUENTES_JURISPRUDENCIA = [
  { value: 'PJ',       label: 'Poder Judicial' },
  { value: 'TC',       label: 'Tribunal Constitucional' },
  { value: 'INDECOPI', label: 'INDECOPI' },
  { value: 'SUNARP',   label: 'SUNARP' },
  { value: 'MINJUS',   label: 'Ministerio de Justicia' },
];

/* ── Configuración de paginación ───────────────────────────── */
export const PAGE_SIZES = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 25;

/* ── Keys de localStorage ──────────────────────────────────── */
export const STORAGE_KEYS = {
  TOKEN:             'legalpro_token',
  SIDEBAR_COLLAPSED: 'legalpro_sidebar_collapsed',
  TOUR_COMPLETED:    'legalpro_tour_completed',
  THEME:             'legalpro_theme',
  LAST_ROUTE:        'legalpro_last_route',
  FILTER_STATE:      'legalpro_filter_state',
};
