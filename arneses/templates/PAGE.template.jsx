// Plantilla de Pagina React 19 con accesibilidad WCAG 2.1 AA
// Ruta: legalpro-app/src/pages/XxxPage.jsx

import { lazy, Suspense } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AuthGuard } from '../components/AuthGuard';
import { Layout } from '../components/Layout';
import { IADisclaimerBanner } from '../components/IADisclaimerBanner';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/EmptyState';
import { useXxx } from '../hooks/useXxx';

const XxxComponent = lazy(() => import('../components/XxxComponent'));

export default function XxxPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useXxx(id);

  if (isLoading) {
    return (
      <Layout>
        <div role="status" aria-live="polite">
          <Spinner size="lg" label="Cargando..." />
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <EmptyState
          title="Error al cargar"
          description={error.message}
          actionLabel="Reintentar"
          onAction={refetch}
        />
      </Layout>
    );
  }

  if (!data) {
    return (
      <Layout>
        <EmptyState
          title="No encontrado"
          description="No se encontró el recurso solicitado"
          actionLabel="Volver"
          onAction={() => navigate(-1)}
        />
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Skip link para accesibilidad */}
      <a href="#main-content" className="skip-link">
        Saltar al contenido principal
      </a>

      {/* Banner de disclaimer IA si aplica */}
      {data.tieneIA && <IADisclaimerBanner />}

      <main id="main-content" aria-labelledby="page-title">
        <header>
          <h1 id="page-title">{data.nombre}</h1>
          <nav aria-label="Migas de pan">
            <ol>
              <li><a href="/">Inicio</a></li>
              <li aria-current="page">{data.nombre}</li>
            </ol>
          </nav>
        </header>

        <Suspense fallback={<Spinner label="Cargando componente..." />}>
          <XxxComponent data={data} />
        </Suspense>
      </main>
    </Layout>
  );
}

// Para usar:
// <Route path="/xxx/:id" element={<AuthGuard roles={['ABOGADO']}><XxxPage /></AuthGuard>} />
