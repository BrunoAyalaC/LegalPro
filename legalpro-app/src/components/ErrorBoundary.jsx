// legalpro-app/src/components/ErrorBoundary.jsx
// Error Boundary global — evita que la app entera se caiga por un error en una página
// Muestra un mensaje amigable y permite recargar

import { Component } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary] Error capturado:', error, errorInfo);
    this.setState({ errorInfo });
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/dashboard';
  };

  render() {
    if (this.state.hasError) {
      // Si es un error dentro del ErrorBoundary mismo, mostrar fallback mínimo
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen bg-[#0b1120] flex items-center justify-center p-4">
          <div className="max-w-md w-full text-center">
            {/* Icono */}
            <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-red-400" />
            </div>

            {/* Título */}
            <h1 className="text-xl font-bold text-white mb-2">
              Algo salió mal
            </h1>
            <p className="text-sm text-slate-400 mb-6">
              Ocurrió un error inesperado en esta sección. El resto del sistema sigue funcionando.
            </p>

            {/* Botones */}
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReload}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-medium text-sm transition-colors"
              >
                <RefreshCw className="w-4 h-4" />
                Reintentar
              </button>
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium text-sm transition-colors"
              >
                <Home className="w-4 h-4" />
                Ir al Dashboard
              </button>
            </div>

            {/* Error detalle (solo dev) */}
            {import.meta.env.DEV && this.state.error && (
              <div className="mt-6 p-4 rounded-xl bg-slate-800/50 border border-slate-700/50 text-left">
                <p className="text-xs font-mono text-red-400 mb-2">{this.state.error.toString()}</p>
                {this.state.errorInfo && (
                  <pre className="text-[10px] font-mono text-slate-500 max-h-32 overflow-auto">
                    {this.state.errorInfo.componentStack}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
