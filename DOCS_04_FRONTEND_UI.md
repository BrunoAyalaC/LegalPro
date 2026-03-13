# 🎨 FRONTEND - UI/UX y Estilos (Personas 3-4)

## Sistema de Diseño

### 1. **TailwindCSS Configuration**
**Ubicación:** `tailwind.config.js`
**Responsables:** Personas 3-4

#### Configuración Base
```js
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#7C3AED',      // Púrpura
        secondary: '#00E5FF',    // Cyan
        accent: '#10B981',       // Verde
        dark: '#0F172A',         // Fondo oscuro
        slate: {
          900: '#0F172A',
          800: '#1E293B',
          700: '#334155',
        }
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'hero': 'clamp(1.8rem, 4vw, 2.8rem)',
        'section': 'clamp(1.5rem, 3vw, 2.2rem)',
      }
    }
  },
  plugins: [require('@tailwindcss/vite')],
}
```

---

### 2. **Paleta de Colores**
**Responsables:** Personas 3-4

#### Colores Principales
```
Primario:     #7C3AED (Púrpura - Botones CTA)
Secundario:   #00E5FF (Cyan - Accents)
Éxito:        #10B981 (Verde - Highlights)
Error:        #EF4444 (Rojo - Errores)
Warning:      #F59E0B (Naranja - Advertencias)
Background:   #0F172A (Gris oscuro)
```

#### Uso en Componentes
```jsx
// Botón primario
<button className="bg-primary text-white px-6 py-3 rounded-lg hover:bg-primary/90">
  Prueba Gratis
</button>

// Card con borde accent
<div className="border-l-4 border-secondary bg-dark rounded-lg p-4">
  Contenido
</div>

// Gradiente
<div className="bg-gradient-to-r from-primary via-secondary to-accent">
  Titulo
</div>
```

---

### 3. **Componentes Reutilizables con Tailwind**
**Ubicación:** `src/components/ui/`
**Responsables:** Personas 3-4

#### Button Component
```jsx
export function Button({ variant = 'primary', size = 'md', children, ...props }) {
  const baseClasses = 'font-semibold rounded-lg transition-all duration-300';
  
  const variants = {
    primary: 'bg-primary text-white hover:bg-primary/90 hover:shadow-lg',
    secondary: 'bg-secondary text-dark hover:bg-secondary/90',
    ghost: 'text-primary border border-primary hover:bg-primary/10',
  };
  
  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };
  
  return (
    <button 
      className={`${baseClasses} ${variants[variant]} ${sizes[size]}`}
      {...props}
    >
      {children}
    </button>
  );
}
```

#### Card Component
```jsx
export function Card({ title, description, icon, className = '' }) {
  return (
    <div className={`bg-dark border border-slate-700 rounded-xl p-6 hover:shadow-xl transition ${className}`}>
      <div className="text-3xl mb-3">{icon}</div>
      <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400">{description}</p>
    </div>
  );
}
```

---

### 4. **Animaciones con Framer Motion**
**Ubicación:** `src/components/animations/`
**Responsables:** Personas 3-4

#### Fade In Animation
```jsx
import { motion } from 'framer-motion';

export function FadeInSection({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      viewport={{ once: true, margin: '-100px' }}
    >
      {children}
    </motion.div>
  );
}
```

#### Stagger Animation (para listas)
```jsx
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    }
  }
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 }
};

export function CardGrid({ cards }) {
  return (
    <motion.div 
      className="grid grid-cols-3 gap-4"
      variants={container}
      initial="hidden"
      whileInView="show"
    >
      {cards.map((card) => (
        <motion.div key={card.id} variants={item}>
          <Card {...card} />
        </motion.div>
      ))}
    </motion.div>
  );
}
```

#### Scroll Progress Bar
```jsx
export function ScrollProgress() {
  const [progress, setProgress] = useState(0);
  
  useEffect(() => {
    const handleScroll = () => {
      const height = document.documentElement.scrollHeight - window.innerHeight;
      const scrolled = (window.scrollY / height) * 100;
      setProgress(scrolled);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  return (
    <motion.div
      className="fixed top-0 left-0 h-1 bg-gradient-to-r from-primary to-secondary"
      style={{ width: `${progress}%` }}
    />
  );
}
```

---

### 5. **Responsive Design**
**Responsables:** Personas 3-4

#### Breakpoints Tailwind
```
sm: 640px
md: 768px
lg: 1024px
xl: 1280px
2xl: 1536px
```

#### Ejemplo Responsive
```jsx
export function ResponsiveGrid() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1 columna mobile, 2 tablet, 4 desktop */}
      {items.map(item => <Card key={item.id} {...item} />)}
    </div>
  );
}

// Tipografía fluida
<h1 className="text-2xl md:text-3xl lg:text-4xl xl:text-5xl">
  Título responsivo
</h1>
```

---

### 6. **Dark Mode Support**
**Responsables:** Personas 3-4

#### Configuración
```jsx
// tailwind.config.js
export default {
  darkMode: 'class',
  // ...
}

// Hook para toggle
export function useDarkMode() {
  const [isDark, setIsDark] = useState(true); // Default: dark
  
  const toggle = () => {
    const html = document.documentElement;
    html.classList.toggle('dark');
    setIsDark(!isDark);
    localStorage.setItem('theme', isDark ? 'light' : 'dark');
  };
  
  return { isDark, toggle };
}
```

---

### 7. **CSS Global**
**Ubicación:** `src/index.css`
**Responsables:** Personas 3-4

#### Estilos Base
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 10px;
}

::-webkit-scrollbar-track {
  background: rgba(15, 23, 42, 0.5);
}

::-webkit-scrollbar-thumb {
  background: #7C3AED;
  border-radius: 5px;
}

/* Smooth scroll behavior */
html {
  scroll-behavior: smooth;
}

/* Selection color */
::selection {
  background: #7C3AED;
  color: white;
}

/* Links */
a {
  @apply text-primary hover:text-secondary transition;
}
```

---

## Guía de Componentes

### Componente Button
```jsx
<Button variant="primary">Primario</Button>
<Button variant="secondary">Secundario</Button>
<Button variant="ghost">Ghost</Button>
<Button size="lg">Grande</Button>
```

### Componente Card
```jsx
<Card 
  title="Feature"
  description="Descripción"
  icon="📱"
  className="col-span-2"
/>
```

---

## Accesibilidad (A11y)
```jsx
// Siempre incluir aria labels
<button aria-label="Cerrar menú">×</button>

// Contraste suficiente
// Usar colores: primary (#7C3AED) y blanco (✓ WCAG AA)

// Enfoque visible
<input className="focus:ring-2 focus:ring-primary focus:outline-none" />

// Semántica HTML
<nav>, <main>, <section>, <article>, <button>, <form>
```

---

## Performance Tips
- ✅ Lazy loading de imágenes: `loading="lazy"`
- ✅ Optimizar SVGs: convertir a componentes React
- ✅ Critical CSS: cargar estilos por encima del pliegue
- ✅ Code splitting: lazy routes con React.lazy()
