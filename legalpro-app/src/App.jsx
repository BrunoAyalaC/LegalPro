import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TenantProvider } from './context/TenantContext';
import { UIProvider } from './context/UIContext';
import Layout from './components/Layout';
import AuthGuard from './components/AuthGuard';

// Rutas con lazy loading — cada página se carga solo cuando se navega a ella
const Login                   = lazy(() => import('./pages/Login'));
const Dashboard               = lazy(() => import('./pages/Dashboard'));
const ChatIA                  = lazy(() => import('./pages/ChatIA'));
const Expedientes             = lazy(() => import('./pages/Expedientes'));
const AnalistaExpedientes     = lazy(() => import('./pages/AnalistaExpedientes'));
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

export default function App() {
  return (
    <UIProvider>
      <TenantProvider>
        <BrowserRouter>
        <Suspense fallback={<div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#0a0a0f', color: '#06B6D4', fontFamily: 'sans-serif' }}>Cargando...</div>}>
        <Routes>
          {/* Rutas públicas */}
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/setup-organizacion" element={<SetupOrganizacion />} />

          <Route element={<AuthGuard><Layout /></AuthGuard>}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/expedientes" element={<Expedientes />} />
          <Route path="/herramientas" element={<Herramientas />} />
          <Route path="/perfil" element={<Perfil />} />
          <Route path="/buscador" element={<BuscadorJurisprudencia />} />
          <Route path="/analista" element={<AnalistaExpedientes />} />
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
          {/* Chat IA y detalle: dentro del Layout para tener sidebar en desktop */}
          <Route path="/chat-ia" element={<ChatIA />} />
          <Route path="/expediente/:id" element={<AnalistaExpedientes />} />
          </Route>

          {/* Ruta publica - sin autenticacion */}
          <Route path="/descargar" element={<Descargar />} />
        </Routes>
        </Suspense>
      </BrowserRouter>
      </TenantProvider>
    </UIProvider>
  );
}
