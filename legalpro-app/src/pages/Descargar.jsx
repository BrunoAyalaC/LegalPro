import AppIcon from '../components/AppIcon';
const logoImg = '/landing/assets/img/logo-icon.jpeg';

const APK_URL = import.meta.env.VITE_APK_URL ?? null;

export default function Descargar() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-6 bg-[#0a0a0f]">
      <img src={logoImg} alt="LegalPro" className="w-20 h-20 object-contain mb-6" />
      <h1 className="text-2xl font-bold text-white mb-1 text-center">LegalPro para Android</h1>
      <p className="text-slate-400 text-sm text-center mb-8 max-w-xs">
        Asistencia legal con IA para abogados, fiscales y jueces peruanos.
      </p>

      <div className="w-full max-w-sm glass border border-white/10 rounded-3xl p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-cyan-500/15 flex items-center justify-center mx-auto mb-4">
          <AppIcon name="android" size={36} className="text-cyan-400" />
        </div>
        <p className="text-xs text-slate-500 uppercase font-bold tracking-widest mb-1">App Nativa</p>
        <p className="text-lg font-bold text-white mb-0.5">Android APK</p>
        <p className="text-xs text-slate-500 mb-6">Android 8.0+ · Gratis · Sin Play Store</p>

        {APK_URL ? (
          <a
            href={APK_URL}
            download="LegalPro.apk"
            className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 transition-all font-bold text-white text-sm shadow-lg shadow-cyan-500/25"
          >
            <AppIcon name="download" size={20} />
            Descargar APK
          </a>
        ) : (
          <div className="py-3.5 rounded-2xl bg-slate-700/50 text-slate-500 text-sm font-medium">
            Próximamente disponible
          </div>
        )}

        <p className="text-[10px] text-slate-600 mt-4">
          Activa &quot;Instalar apps desconocidas&quot; en Ajustes antes de instalar.
        </p>
      </div>

      <div className="w-full max-w-sm mt-6 space-y-3">
        {[
          { n: '1', text: 'Descarga el archivo APK' },
          { n: '2', text: 'Abre el archivo desde tu celular' },
          { n: '3', text: 'Permite instalar apps externas si se solicita' },
          { n: '4', text: 'Inicia sesión y usa LegalPro' },
        ].map(({ n, text }) => (
          <div key={n} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <span className="text-xs font-bold text-indigo-400">{n}</span>
            </div>
            <p className="text-sm text-slate-400">{text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
