import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { TenantProvider } from './context/TenantContext';
import Layout from './components/Layout';
import AuthGuard from './components/AuthGuard';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ChatIA from './pages/ChatIA';
import Expedientes from './pages/Expedientes';
import AnalistaExpedientes from './pages/AnalistaExpedientes';
import SimuladorJuicios from './pages/SimuladorJuicios';
import BuscadorJurisprudencia from './pages/BuscadorJurisprudencia';
import RedactorEscritos from './pages/RedactorEscritos';
import PredictorJudicial from './pages/PredictorJudicial';
import Herramientas from './pages/Herramientas';
import Perfil from './pages/Perfil';
import GeneradorAlegatos from './pages/GeneradorAlegatos';
import EstrategiaInterrogatorio from './pages/EstrategiaInterrogatorio';
import AsistenteObjeciones from './pages/AsistenteObjeciones';
import MonitorSinoe from './pages/MonitorSinoe';
import ComparadorPrecedentes from './pages/ComparadorPrecedentes';
import BovedaEvidencia from './pages/BovedaEvidencia';
import GestionMultidoc from './pages/GestionMultidoc';
import GeneradorCasosCriticos from './pages/GeneradorCasosCriticos';
import ResumenEjecutivo from './pages/ResumenEjecutivo';
import ReporteRetroalimentacion from './pages/ReporteRetroalimentacion';
import ConfigEspecialidad from './pages/ConfigEspecialidad';
import SetupOrganizacion from './pages/SetupOrganizacion';
import Descargar from './pages/Descargar';
import Landing from './pages/Landing';

export default function App() {
  return (
    <TenantProvider>
      <BrowserRouter>
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
          </Route>

          {/* Full-screen pages without bottom nav */}
          <Route path="/chat-ia" element={<AuthGuard><ChatIA /></AuthGuard>} />
          <Route path="/expediente/:id" element={<AuthGuard><AnalistaExpedientes /></AuthGuard>} />

          {/* Ruta publica - sin autenticacion */}
          <Route path="/descargar" element={<Descargar />} />
        </Routes>
      </BrowserRouter>
    </TenantProvider>
  );
}
