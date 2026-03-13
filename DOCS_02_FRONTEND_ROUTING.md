# 🧭 FRONTEND - Navegación y Routing (Personas 3-4)

## Arquitectura de Routing

### 1. **React Router v7 Setup**
**Ubicación:** `src/main.jsx`
**Responsables:** Personas 3-4

#### Configuración Base
```jsx
import { BrowserRouter as Router } from 'react-router-dom';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <Router basename={import.meta.env.BASE_URL}>
    <App />
  </Router>
);
```

**Parámetro clave:** `basename="/Abogacia/"` → Permite navegación en subdirectorio de GitHub Pages

---

### 2. **Rutas Principales: src/App.jsx**
**Responsables:** Personas 3-4

#### Definición de Rutas
```jsx
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/caracteristicas" element={<Features />} />
      <Route path="/roles" element={<RolesPage />} />
      <Route path="/demo" element={<DemoCoursel />} />
      <Route path="/precios" element={<Precios />} />
      <Route path="/contacto" element={<Contacto />} />
      {/* 404 Fallback */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
```

---

### 3. **Componente de Navegación Interna**
**Ubicación:** `src/components/NavLinks.jsx`
**Responsables:** Personas 3-4

#### Métodos Principales
```jsx
export const NAV_ITEMS = [
  { path: "/", label: "Inicio" },
  { path: "/caracteristicas", label: "Características" },
  { path: "/roles", label: "Roles" },
  { path: "/precios", label: "Precios" },
  { path: "/contacto", label: "Contacto" }
];

export default function NavLinks() {
  return (
    <nav>
      {NAV_ITEMS.map(item => (
        <Link key={item.path} to={item.path}>
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
```

---

### 4. **Navegación por Secciones (Anchor Links)**
**Responsables:** Personas 3-4

#### Método: Scroll a Secciones
```jsx
// Navegar a section por ID
<a href="#features">Ver Features</a>

// En componente:
<section id="features">Contenido</section>

// Con React Router:
import { useNavigate } from 'react-router-dom';

export function FeatureLink() {
  const navigate = useNavigate();
  
  const goToFeatures = () => {
    navigate('/#features'); // Navega y hace scroll
  };
  
  return <button onClick={goToFeatures}>Ver Todo</button>;
}
```

---

### 5. **Navegación entre Páginas**
**Responsables:** Personas 3-4

#### Método: useNavigate Hook
```jsx
import { useNavigate } from 'react-router-dom';

export function CTAButton() {
  const navigate = useNavigate();
  
  const handlePruebaGratis = () => {
    navigate('/demo');
    // Ejecuta transición de página
  };
  
  return (
    <button onClick={handlePruebaGratis}>
      Prueba Gratis 14 días
    </button>
  );
}
```

---

### 6. **Manejo de Rutas Dinámicas**
**Responsables:** Personas 3-4

#### Ejemplo: Página de Detalles
```jsx
// Ruta: /feature/:id
<Route path="/feature/:id" element={<FeatureDetail />} />

// Componente:
export function FeatureDetail() {
  const { id } = useParams();
  const feature = FEATURES.find(f => f.id === id);
  
  return <div>{feature.name}</div>;
}
```

---

### 7. **Navegación Móvil (Menu Hamburguesa)**
**Ubicación:** `src/components/MobileMenu.jsx`
**Responsables:** Personas 3-4

#### Métodos
```jsx
export default function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();
  
  const handleNavigation = (path) => {
    navigate(path);
    setIsOpen(false); // Cierra menú tras navegar
  };
  
  return (
    <>
      {isOpen && (
        <div className="mobile-menu">
          {NAV_ITEMS.map(item => (
            <button 
              key={item.path}
              onClick={() => handleNavigation(item.path)}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
```

---

### 8. **Manejo de Errores de Navegación**
**Responsables:** Personas 3-4

#### Componente 404 Page
```jsx
export function NotFound() {
  const navigate = useNavigate();
  
  return (
    <div className="error-page">
      <h1>404 - Página no encontrada</h1>
      <button onClick={() => navigate('/')}>
        Volver al inicio
      </button>
    </div>
  );
}
```

---

## Flujo de Navegación

```
┌─ Navbar → Link a /características
├─ Hero → CTA a /demo
├─ Feature Cards → Detalles /:id
├─ Roles Section → /roles
├─ Footer → /contacto
└─ Mobile Menu → Todas las rutas
```

---

## Dependencias
- **react-router-dom ^7.13.1** - SPA Routing
- **framer-motion** - Animaciones de transición

---

## Performance: Lazy Loading
```jsx
import { lazy, Suspense } from 'react';

const Features = lazy(() => import('./pages/Features'));
const Demo = lazy(() => import('./pages/Demo'));

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/caracteristicas" element={<Features />} />
        <Route path="/demo" element={<Demo />} />
      </Routes>
    </Suspense>
  );
}
```

Esto carga las páginas bajo demanda para mejorar performance inicial.
