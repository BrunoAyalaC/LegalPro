import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppIcon from '../components/AppIcon';
const logoImg = '/landing/assets/img/logo-icon.jpeg';
import fondoLogin from '../assets/backgrounds/fondo_login.jpeg';
import { useTenant } from '../context/TenantContext';

export default function Login() {
  const navigate = useNavigate();
  const { login, isLoading: contextLoading } = useTenant();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { organizacion } = await login(email, password);
      if (!organizacion) {
        navigate('/setup-organizacion');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.message ?? 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  const isSubmitting = loading || contextLoading;

  return (
    <div className="relative min-h-dvh flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* BACKGROUND IMAGE */}
      <div className="fixed inset-0 z-[-1]">
        <img src={fondoLogin} alt="Fondo" className="w-full h-full object-cover" />
        {/* Dark gradient overlay for readability */}
        <div className="absolute inset-0 bg-linear-to-b from-[#0f131a]/60 via-[#0f131a]/80 to-[#0f131a]"></div>
      </div>

      <div className="w-full max-w-sm anim-fade-in-up">
        {/* LOGO */}
        <div className="flex justify-center mb-8">
          <div className="w-24 h-24 rounded-3xl bg-white/5 border border-white/10 flex items-center justify-center shadow-2xl backdrop-blur-md anim-float">
            <img src={logoImg} alt="LegalPro" className="w-16 h-16 object-contain" />
          </div>
        </div>

        {/* LOGIN CARD */}
        <div className="glass rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-indigo-500/30 rounded-full blur-3xl"></div>
          
          <div className="text-center mb-8 relative z-10">
            <h1 className="text-2xl font-black mb-2 tracking-tight text-white">LegalPro <span className="text-indigo-400">AI</span></h1>
            <p className="text-sm text-slate-400">Ingresa tus credenciales para continuar</p>
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium text-center relative z-10">
              {error}
            </div>
          )}
          <form onSubmit={handleLogin} className="space-y-4 relative z-10">
            <div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <AppIcon name="person" size={20} className="icon-muted group-focus-within:icon-indigo transition-colors" />
                </div>
                <input 
                  type="email" 
                  className="input pl-12 py-3.5 w-full bg-black/20 border-white/10 focus:border-indigo-500/50 text-white placeholder:text-slate-500 rounded-xl" 
                  placeholder="Correo electrónico"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <AppIcon name="security" size={20} className="icon-muted group-focus-within:icon-indigo transition-colors" />
                </div>
                <input 
                  type="password" 
                  className="input pl-12 py-3.5 w-full bg-black/20 border-white/10 focus:border-indigo-500/50 text-white placeholder:text-slate-500 rounded-xl" 
                  placeholder="Contraseña"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="flex items-center justify-between text-xs font-medium pt-2 pb-4">
              <label className="flex items-center gap-2 cursor-pointer text-slate-300">
                <input type="checkbox" className="rounded accent-indigo-500 opacity-70" defaultChecked />
                Recordarme
              </label>
              <a href="#" className="text-indigo-400 hover:text-indigo-300 transition-colors">¿Olvidó su contraseña?</a>
            </div>

            <button 
              type="submit" 
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full py-4 rounded-xl bg-linear-to-r from-indigo-600 to-violet-600 text-white font-bold tracking-wide shadow-[0_4px_20px_rgba(99,102,241,0.4)] hover:shadow-[0_6px_28px_rgba(99,102,241,0.6)] active:scale-[0.98] transition-all flex justify-center items-center gap-2 disabled:opacity-70"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>Iniciar Sesión <AppIcon name="login" size={20} className="icon-raw" style={{ filter: 'brightness(0) invert(1)' }} /></>
              )}
            </button>
          </form>
        </div>

        {/* FOOTER */}
        <p className="text-center text-xs text-slate-500 mt-8 font-medium">
          Impulsado por Gemini AI &copy; 2026
        </p>
      </div>
    </div>
  );
}
