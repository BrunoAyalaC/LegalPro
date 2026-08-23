import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { TenantProvider } from './context/TenantContext';
import { UIProvider } from './context/UIContext';
import Layout from './components/Layout';
import AuthGuard from './components/AuthGuard';
import LoadingScreen from './components/LoadingScreen';
import ScrollToTop from './components/ScrollToTop';

// FIX UX (2026-08-23): transición de ruta animada. AnimatedRoutes re-monta el
// contenedor por pathname → fade-in suave entre páginas (el CSS respeta
// prefers-reduced-motion). ScrollToTop evita llegar a una vista a mitad de scroll.
function AnimatedRoutes({ children }) {
  const location = useLocation();
  return (
    <div key={location.pathname} className="route-fade-in">
      {children}
    </div>
  );
}
import ErrorBoundary from './components/ErrorBoundary';

// Rutas con lazy loading — cada página se carga solo cuando se navega a ella
const Login                   = lazy(() => import('./pages/Login'));
const SignupPage              = lazy(() => import('./pages/SignupPage'));
const Dashboard               = lazy(() => import('./pages/Dashboard'));
const ChatIA                  = lazy(() => import('./pages/ChatIA'));
const Expedientes             = lazy(() => import('./pages/Expedientes'));
const AnalistaExpedientes     = lazy(() => import('./pages/AnalistaExpedientes'));
const PanelExpertos           = lazy(() => import('./pages/PanelExpertos'));
const SimuladorJuicios        = lazy(() => import('./pages/SimuladorJuicios'));
const BuscadorJurisprudencia  = lazy(() => import('./pages/BuscadorJurisprudencia'));
const RedactorEscritos        = lazy(() => import('./pages/RedactorEscritos'));
const PredictorJudicial       = lazy(() => import('./pages/PredictorJudicial'));
const Herramientas            = lazy(() => import('./pages/Herramientas'));
const Perfil                  = lazy(() => import('./pages/Perfil'));
const GeneradorAlegatos       = lazy(() => import('./pages/GeneradorAlegatos'));
const EstrategiaInterrogatorio= lazy(() => import('./pages/EstrategiaInterrogatorio'));
const AsistenteObjeciones     = lazy(() => import('./pages/AsistenteObjeciones'));
const MonitorSinoe            = lazy(() => import('./pages/MonitorSinoe'));
const ComparadorPrecedentes   = lazy(() => import('./pages/ComparadorPrecedentes'));
const BovedaEvidencia         = lazy(() => import('./pages/BovedaEvidencia'));
const GestionMultidoc         = lazy(() => import('./pages/GestionMultidoc'));
const GeneradorCasosCriticos  = lazy(() => import('./pages/GeneradorCasosCriticos'));
const ResumenEjecutivo        = lazy(() => import('./pages/ResumenEjecutivo'));
const ReporteRetroalimentacion= lazy(() => import('./pages/ReporteRetroalimentacion'));
const ConfigEspecialidad      = lazy(() => import('./pages/ConfigEspecialidad'));
const SetupOrganizacion       = lazy(() => import('./pages/SetupOrganizacion'));
const Descargar               = lazy(() => import('./pages/Descargar'));
const Landing                 = lazy(() => import('./pages/Landing'));
const PanelCreditos           = lazy(() => import('./pages/PanelCreditos'));
const CalculadoraPlazos       = lazy(() => import('./pages/CalculadoraPlazos'));
const CalendarioVencimientos  = lazy(() => import('./pages/CalendarioVencimientos'));
const Clientes                = lazy(() => import('./pages/Clientes'));
const Contador                = lazy(() => import('./pages/Contador'));
const CalendarioPlazos        = lazy(() => import('./pages/CalendarioPlazos'));
const CalculadoraIntereses    = lazy(() => import('./pages/CalculadoraIntereses'));
const ExploradorDelitos       = lazy(() => import('./pages/ExploradorDelitos'));
const PrescripcionCaducidad   = lazy(() => import('./pages/PrescripcionCaducidad'));
const ConversorUIT            = lazy(() => import('./pages/ConversorUIT'));
const ConversorPlazos         = lazy(() => import('./pages/ConversorPlazos'));
const IndemnizacionDespido    = lazy(() => import('./pages/IndemnizacionDespido'));
const TasasComparativo        = lazy(() => import('./pages/TasasComparativo'));
const Privacidad              = lazy(() => import('./pages/Privacidad'));
const NotFound                = lazy(() => import('./pages/NotFound'));

export default function App() {
  return (
    <UIProvider>
      <TenantProvider>
        <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<LoadingScreen />}>
        <AnimatedRoutes>
          <Routes>
          {/* Rutas públicas */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/setup-organizacion" element={<SetupOrganizacion />} />

          <Route element={<AuthGuard><ErrorBoundary><Layout /></ErrorBoundary></AuthGuard>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/expedientes" element={<Expedientes />} />
          <Route path="/herramientas" element={<Herramientas />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/buscador" element={<BuscadorJurisprudencia />} />
          <Route path="/analista" element={<AnalistaExpedientes />} />
          <Route path="/panel-expertos" element={<PanelExpertos />} />
          <Route path="/simulador" element={<SimuladorJuicios />} />
          <Route path="/redactor" element={<RedactorEscritos />} />
          <Route path="/predictor" element={<PredictorJudicial />} />
          <Route path="/alegatos" element={<GeneradorAlegatos />} />
          <Route path="/interrogatorio" element={<EstrategiaInterrogatorio />} />
          <Route path="/objeciones" element={<AsistenteObjeciones />} />
          <Route path="/monitor-sinoe" element={<MonitorSinoe />} />
          <Route path="/comparador" element={<ComparadorPrecedentes />} />
          <Route path="/boveda" element={<BovedaEvidencia />} />
          <Route path="/multidoc" element={<GestionMultidoc />} />
          <Route path="/casos-criticos" element={<GeneradorCasosCriticos />} />
          <Route path="/resumen-ejecutivo" element={<ResumenEjecutivo />} />
          <Route path="/retroalimentacion" element={<ReporteRetroalimentacion />} />
          <Route path="/config-especialidad" element={<ConfigEspecialidad />} />
          <Route path="/creditos" element={<PanelCreditos />} />
          <Route path="/calculadora-plazos" element={<CalculadoraPlazos />} />
          <Route path="/calendario-vencimientos" element={<CalendarioVencimientos />} />
          <Route path="/clientes" element={<Clientes />} />
          <Route path="/contador" element={<Contador />} />
          <Route path="/calendario-plazos" element={<CalendarioPlazos />} />
          {/* Herramientas determinísticas (sin IA) — /api/herramientas/* */}
          <Route path="/calculadora-intereses" element={<CalculadoraIntereses />} />
          <Route path="/explorador-delitos" element={<ExploradorDelitos />} />
          <Route path="/prescripcion" element={<PrescripcionCaducidad />} />
          <Route path="/conversor-uit" element={<ConversorUIT />} />
          <Route path="/conversor-plazos" element={<ConversorPlazos />} />
          <Route path="/indemnizacion-despido" element={<IndemnizacionDespido />} />
          <Route path="/tasas-comparativo" element={<TasasComparativo />} />
          {/* Chat IA y detalle: dentro del Layout para tener sidebar en desktop */}
          <Route path="/chat" element={<Navigate to="/chat-ia" replace />} />
          <Route path="/chat-ia" element={<ChatIA />} />
          <Route path="/expediente/:id" element={<AnalistaExpedientes />} />
          </Route>

          {/* Ruta publica - sin autenticacion */}
          <Route path="/descargar" element={<Descargar />} />
          {/* Ruta publica - legal (politica de privacidad) sin autenticacion */}
          <Route path="/legal/privacidad" element={<Privacidad />} />

          {/* Catch-all 404 — cualquier ruta no registrada (fuera del AuthGuard) */}
          <Route path="*" element={<NotFound />} />
        </Routes>
        </AnimatedRoutes>
        </Suspense>
      </BrowserRouter>
      </TenantProvider>
    </UIProvider>
  );
}
