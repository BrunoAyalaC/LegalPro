# 📱 FRONTEND - Componentes Principales (Personas 1-2)

## Estructura de Componentes

### 1. **Componente: Navbar.jsx**
**Ubicación:** `src/components/Navbar.jsx`  
**Responsables:** Personas 1-2

#### Descripción
Barra de navegación superior que contiene el logo, menú y CTA (Call To Action).

#### Métodos Principales
```jsx
export default function Navbar() {
  - Renderiza logo con BASE_URL dinámico
  - Navega a secciones usando react-router-dom
  - Botón "Prueba gratis 14 días"
  - Responsive en dispositivos móviles
}
```

#### Props
- **Ninguno** - Componente sin props

#### Estado
- **Ninguno** - Componente presentacional (stateless)

#### Dependencias
- `react-router-dom`: Para navegación
- `import.meta.env.BASE_URL`: Para logo responsivo en GitHub Pages

---

### 2. **Componente: Hero.jsx**
**Ubicación:** `src/components/Hero.jsx`  
**Responsables:** Personas 1-2

#### Descripción
Sección hero con video de fondo, titulares y CTA principal.

#### Métodos Principales
```jsx
export default function Hero() {
  - Video de fondo: BASE_URL + "bg_hero.mp4"
  - Animaciones fade-in con Framer Motion
  - Dos botones: CTA principal + "Ver Demo"
  - Contadores: "15,000+ abogados", "94% precisión"
}
```

#### Props
- **Ninguno**

#### Dependencias
- `framer-motion`: Animaciones
- `BASE_URL`: Rutas dinámicas

---

### 3. **Componente: LogosStrip.jsx**
**Ubicación:** `src/components/LogosStrip.jsx`  
**Responsables:** Personas 1-2

#### Descripción
Carrusel con logos de instituciones (SUNARP, INDECOPI, Poder Judicial, etc.)

#### Métodos Principales
```jsx
export default function LogosStrip() {
  - Array de logos: SUNARP, INDECOPI, SJM, CEJ
  - Animación scroll infinito
  - Responsive grid layout
}
```

---

### 4. **Componente: Card.jsx** (Reutilizable)
**Ubicación:** `src/components/Card.jsx`  
**Responsables:** Personas 1-2

#### Descripción
Componente tarjeta genérico para mostrar features.

#### Métodos Principales
```jsx
export default function Card({ title, description, icon, color }) {
  - Props:
    - title: string
    - description: string
    - icon: React Component
    - color: hex color
  - Renderiza con fondo dinámico según color
  - Hover effect con Framer Motion
}
```

---

### 5. **Componente: Feature.jsx**
**Ubicación:** `src/components/Feature.jsx`  
**Responsables:** Personas 1-2

#### Descripción
Componente que muestra una feature con imagen/video y descripción.

#### Props
```jsx
{
  title: string,
  description: string,
  media: { src: string, type: "image|video" },
  alignment: "left|right"
}
```

---

## Flujo de Componentes

```
App.jsx
├── Navbar.jsx
├── Hero.jsx
├── LogosStrip.jsx
├── Features Section
│   ├── Feature.jsx (x13 features)
│   └── Card.jsx (x13 cards)
├── Roles Section
│   └── Card.jsx (x4 roles)
└── Footer.jsx
```

---

## Stack Tecnológico
- **React 19.2.0**
- **Vite 7.3.1**
- **Framer Motion 12.36.0** - Animaciones
- **React Router v7.13.1** - SPA Routing
- **TailwindCSS 4.2.1** - Estilos

---

## Archivo Base: src/App.jsx
Componente raíz que orquesta todos los componentes presentacionales.

```jsx
export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Hero />
      <LogosStrip />
      <FeaturesSection />
      <RolesSection />
      <Footer />
    </BrowserRouter>
  )
}
```
