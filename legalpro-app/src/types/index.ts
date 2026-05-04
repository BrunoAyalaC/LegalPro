// Tipos de dominio LegalPro

export interface Usuario {
  id: string | number | null;
  email: string | null;
  nombreCompleto: string;
  rol: string;
  especialidad: string | null;
}

export interface Organizacion {
  id: string | number;
  nombre: string;
  slug: string | null;
  plan: string;
  maxUsuarios: number;
  expedientesMax: number;
  expedientesUsados: number;
  usuariosUsados: number;
  rolOrg: string | null;
  isOrgAdmin: boolean;
}

export interface TenantState {
  token: string | null;
  usuario: Usuario | null;
  organizacion: Organizacion | null;
}

export interface LoginResult {
  token: string;
  usuario: Usuario | null;
  organizacion: Organizacion | null;
}

export interface TenantContextType extends TenantState {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  logout: () => void;
  refreshToken: () => Promise<void>;
}

export interface ToastItem {
  id: number;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning' | 'ai';
  duration: number;
  action?: (() => void) | null;
}

export interface ToastOptions {
  duration?: number;
  action?: (() => void) | null;
}

export interface ConfirmModalState {
  title: string;
  description?: string;
  confirmText: string;
  danger: boolean;
}

export interface AddToastInput {
  message: string;
  type?: ToastItem['type'];
  duration?: number;
  action?: (() => void) | null;
}

export interface UIContextType {
  toasts: ToastItem[];
  addToast: (toast: AddToastInput) => number;
  removeToast: (id: number) => void;
  toast: {
    success: (msg: string, opts?: ToastOptions) => number;
    error: (msg: string, opts?: ToastOptions) => number;
    warning: (msg: string, opts?: ToastOptions) => number;
    info: (msg: string, opts?: ToastOptions) => number;
    ai: (msg: string, opts?: ToastOptions) => number;
  };
  commandOpen: boolean;
  openCommand: () => void;
  closeCommand: () => void;
  confirmModal: ConfirmModalState | null;
  confirm: (opts: Omit<ConfirmModalState, 'confirmText' | 'danger'> & { confirmText?: string; danger?: boolean }) => Promise<boolean>;
  resolveConfirm: (result: boolean) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
}

export interface Caso {
  id: string | number;
  titulo: string;
  descripcion?: string;
  estado: string;
  prioridad?: string;
  fechaCreacion?: string;
  fechaActualizacion?: string;
  clienteId?: string | number;
  abogadoId?: string | number;
}
