# 👤 PERSONA 2 - Routing y Navegación

## Sistema de Routing

### 1. **Configuración en main.jsx**
**Ubicación:** `src/main.jsx`

```jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter as Router } from 'react-router-dom'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router basename={import.meta.env.BASE_URL}>
      <App />
    </Router>
  </React.StrictMode>,
)
```

**Métodos usados:**
- `BrowserRouter`: Proveedor de routing
- `basename="/Abogacia/"`: Configura la ruta base para GitHub Pages
- `StrictMode`: Detecta problemas en desarrollo

---

### 2. **Definición de Rutas en App.jsx**
**Ubicación:** `src/App.jsx`

```jsx
import { Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import LandingPage from './pages/LandingPage';
import Caracteristicas from './pages/Caracteristicas';
import Roles from './pages/Roles';
import Precios from './pages/Precios';
import Contacto from './pages/Contacto';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <>
      <Navbar />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/caracteristicas" element={<Caracteristicas />} />
        <Route path="/roles" element={<Roles />} />
        <Route path="/precios" element={<Precios />} />
        <Route path="/contacto" element={<Contacto />} />
        {/* Página 404 para rutas no encontradas */}
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Footer />
    </>
  );
}
```

**Métodos:**
- `Routes`: Contenedor de rutas
- `Route path=`: Define URL
- `element=`: Componente a renderizar
- `path="*"`: Fallback para 404

---

### 3. **Constantes de Rutas**
**Ubicación:** `src/constants/routes.js`

```js
export const ROUTES = {
  HOME: '/',
  CARACTERISTICAS: '/caracteristicas',
  ROLES: '/roles',
  PRECIOS: '/precios',
  CONTACTO: '/contacto',
};

export const NAV_ITEMS = [
  { path: ROUTES.HOME, label: 'Inicio' },
  { path: ROUTES.CARACTERISTICAS, label: 'Características' },
  { path: ROUTES.ROLES, label: 'Roles' },
  { path: ROUTES.PRECIOS, label: 'Precios' },
  { path: ROUTES.CONTACTO, label: 'Contacto' },
];
```

**Ventaja:** Evitar hardcodear strings en toda la app

---

### 4. **Navegación con Link**
**Ubicación:** `src/components/NavLinks.jsx`

```jsx
import { Link } from 'react-router-dom';
import { NAV_ITEMS } from '../constants/routes';

export default function NavLinks() {
  return (
    <nav className="flex gap-8">
      {NAV_ITEMS.map(item => (
        <Link 
          key={item.path} 
          to={item.path}
          className="text-white hover:text-secondary transition"
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

**Métodos:**
- `Link to=`: Navegación sin recargar
- `.map()`: Renderiza lista dinámicamente
- CSS: Hover effect

---

### 5. **Hook useNavigate() para Navegación Programática**
**Ubicación:** `src/components/CTAButton.jsx`

```jsx
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../constants/routes';

export default function CTAButton() {
  const navigate = useNavigate();
  
  const handleClick = () => {
    // Navega a la página de precios
    navigate(ROUTES.PRECIOS);
  };
  
  return (
    <button 
      onClick={handleClick}
      className="bg-primary text-white px-6 py-3 rounded-lg"
    >
      Ver Planes
    </button>
  );
}
```

**Métodos:**
- `useNavigate()`: Hook para navegar programáticamente
- `navigate(path)`: Cambia de ruta
- Útil para navegar después de acciones (submit, click, etc)

---

### 6. **Rutas Dinámicas con Parámetros**
**Ubicación:** `src/App.jsx` (agregado a Routes)

```jsx
<Route path="/feature/:id" element={<FeatureDetail />} />
```

**Componente que recibe parámetro:**

```jsx
import { useParams } from 'react-router-dom';

export default function FeatureDetail() {
  const { id } = useParams();
  
  // Busca feature por ID
  const feature = FEATURES.find(f => f.id === id);
  
  if (!feature) return <NotFound />;
  
  return (
    <div>
      <h1>{feature.title}</h1>
      <p>{feature.description}</p>
    </div>
  );
}
```

**Métodos:**
- `useParams()`: Obtiene parámetros de URL
- `:id`: Parte dinámica de URL
- `/feature/1` → `id = "1"`

---

### 7. **Navegación con Scroll a Secciones**
**Ubicación:** `src/utils/scrollToSection.js`

```js
export function scrollToSection(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.scrollIntoView({ behavior: 'smooth' });
  }
}
```

**Uso:**

```jsx
import { scrollToSection } from '../utils/scrollToSection';

export function FeatureLink() {
  const handleClick = () => {
    scrollToSection('features-section');
  };
  
  return (
    <button onClick={handleClick}>
      Ver Features
    </button>
  );
}

// En otra página:
<section id="features-section">
  {/* Contenido */}
</section>
```

**Métodos:**
- `document.getElementById()`: Busca elemento por ID
- `.scrollIntoView()`: Anima scroll suave

---

### 8. **Componente 404 - Página No Encontrada**
**Ubicación:** `src/pages/NotFound.jsx`

```jsx
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function NotFound() {
  const navigate = useNavigate();
  
  return (
    <motion.div 
      className="min-h-screen flex items-center justify-center text-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div>
        <h1 className="text-6xl font-bold text-primary mb-4">404</h1>
        <p className="text-xl text-slate-300 mb-8">Página no encontrada</p>
        <button 
          onClick={() => navigate('/')}
          className="bg-primary text-white px-8 py-3 rounded-lg"
        >
          Volver al inicio
        </button>
      </div>
    </motion.div>
  );
}
```

**Métodos:**
- `navigate('/')`: Regresa a inicio
- Animación al entrar en página

---

## Lazy Loading de Rutas (Performance)

**Ubicación:** `src/App.jsx`

```jsx
import { lazy, Suspense } from 'react';

// Carga páginas solo cuando se necesitan
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Caracteristicas = lazy(() => import('./pages/Caracteristicas'));
const Precios = lazy(() => import('./pages/Precios'));

export default function App() {
  return (
    <Routes>
      <Route 
        path="/" 
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <LandingPage />
          </Suspense>
        } 
      />
      <Route 
        path="/caracteristicas" 
        element={
          <Suspense fallback={<LoadingSpinner />}>
            <Caracteristicas />
          </Suspense>
        } 
      />
      {/* ... más rutas */}
    </Routes>
  );
}

function LoadingSpinner() {
  return <div className="text-center py-20">Cargando...</div>;
}
```

**Beneficio:** Solo descarga código de página cuando se accede

**Métodos:**
- `lazy()`: Carga componente dinámicamente
- `Suspense`: Muestra fallback mientras carga
- Reduce tamaño inicial del bundle

---

## Resumen de Métodos de Routing

| Método | ¿Qué hace? |
|--------|-----------|
| `BrowserRouter` | Proveedor de routing |
| `basename=` | Configura ruta base |
| `Routes` | Contenedor de rutas |
| `Route path=` | Define URL + componente |
| `Link to=` | Navega sin recargar |
| `useNavigate()` | Hook para navegar |
| `navigate(path)` | Cambia de ruta |
| `useParams()` | Obtiene parámetros URL |
| `scrollToSection()` | Scroll suave a elemento |
| `lazy()` | Carga dinámicamente |
| `Suspense` | Muestra loading |

---

## ¿Cómo Explicar en Presentación?

1. **Configuración**: `basename` en GitHub Pages
2. **Rutas Básicas**: HOME, CARACTERÍSTICAS, PRECIOS, etc
3. **Navegación**: Link vs useNavigate
4. **Rutas Dinámicas**: /feature/:id
5. **Scroll a Secciones**: scrollToSection()
6. **404 Handling**: NotFound page
7. **Performance**: Lazy Loading
8. **Flujo Completo**: Usuario hace click → navega → se carga página → scroll suave
