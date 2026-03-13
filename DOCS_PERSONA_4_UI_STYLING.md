# 👤 PERSONA 4 - UI/Diseño & Styling

## Configuración TailwindCSS

**Ubicación:** `tailwind.config.js`

```js
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Colores principales
        primary: '#1e3a8a',      // Azul oscuro
        secondary: '#0ea5e9',    // Azul claro
        accent: '#f59e0b',       // Ámbar
        danger: '#ef4444',       // Rojo
        success: '#10b981',      // Verde
        warning: '#eab308',      // Amarillo
        
        // Escalas de grises
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
      },
      fonts: {
        sans: ['Inter', 'sans-serif'],
        serif: ['Merriweather', 'serif'],
      },
      spacing: {
        128: '32rem',
        144: '36rem',
      },
      borderRadius: {
        '4xl': '2rem',
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
    require('@tailwindcss/typography'),
  ],
};
```

---

## Colores en Componentes

**Ubicación:** `src/constants/colors.js`

```js
export const COLORS = {
  PRIMARY: '#1e3a8a',
  SECONDARY: '#0ea5e9',
  ACCENT: '#f59e0b',
  DANGER: '#ef4444',
  SUCCESS: '#10b981',
  SLATE: {
    50: '#f8fafc',
    900: '#0f172a',
  },
};

// Mapeo Tailwind → JavaScript
export function getTailwindColor(name) {
  const mapping = {
    'primary': 'bg-primary',
    'secondary': 'bg-secondary',
    'accent': 'bg-accent',
  };
  return mapping[name];
}
```

---

## Componentes Estilizados

### 1. Badge/Etiqueta

**Ubicación:** `src/components/Badge.jsx`

```jsx
export function Badge({ children, color = 'primary', size = 'md' }) {
  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-3 text-base',
  };
  
  const colorClasses = {
    primary: 'bg-primary text-white',
    secondary: 'bg-secondary text-white',
    accent: 'bg-accent text-slate-900',
    danger: 'bg-danger text-white',
    success: 'bg-success text-white',
  };
  
  return (
    <span className={`
      rounded-full font-semibold
      ${sizeClasses[size]}
      ${colorClasses[color]}
    `}>
      {children}
    </span>
  );
}
```

**Uso:**

```jsx
<Badge color="primary" size="md">Pendiente</Badge>
<Badge color="success" size="sm">Aprobado</Badge>
```

---

### 2. Botón Estilizado

**Ubicación:** `src/components/Button.jsx`

```jsx
export function Button({ 
  children, 
  variant = 'primary', 
  size = 'md',
  disabled = false,
  onClick,
}) {
  const variants = {
    primary: 'bg-primary hover:bg-blue-900 text-white',
    secondary: 'bg-secondary hover:bg-blue-400 text-white',
    outline: 'border-2 border-primary text-primary hover:bg-primary hover:text-white',
    ghost: 'text-primary hover:bg-slate-100',
  };
  
  const sizes = {
    sm: 'px-3 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
  };
  
  const disabledClass = disabled ? 'opacity-50 cursor-not-allowed' : '';
  
  return (
    <button 
      className={`
        rounded-lg font-semibold transition-colors
        ${variants[variant]}
        ${sizes[size]}
        ${disabledClass}
      `}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
```

**Uso:**

```jsx
<Button variant="primary" size="md">Guardar</Button>
<Button variant="outline">Cancelar</Button>
<Button variant="ghost" disabled>Deshabilitado</Button>
```

---

### 3. Card Reutilizable

**Ubicación:** `src/components/Card.jsx`

```jsx
export function Card({ 
  title, 
  description, 
  icon: Icon, 
  color = 'primary',
  children,
}) {
  const borderColor = {
    primary: 'border-l-primary',
    secondary: 'border-l-secondary',
    accent: 'border-l-accent',
  };
  
  return (
    <div className={`
      bg-white rounded-lg shadow-lg p-6
      border-l-4 ${borderColor[color]}
      hover:shadow-xl transition-shadow
    `}>
      <div className="flex items-center gap-4 mb-4">
        {Icon && <Icon className="w-8 h-8 text-primary" />}
        <h3 className="text-xl font-bold text-slate-900">{title}</h3>
      </div>
      
      {description && (
        <p className="text-slate-600 mb-4">{description}</p>
      )}
      
      {children && <div>{children}</div>}
    </div>
  );
}
```

**Uso:**

```jsx
<Card 
  title="Expediente #001"
  description="Caso civil importante"
  icon={FileIcon}
  color="secondary"
>
  <p>Contenido extra</p>
</Card>
```

---

## Animaciones con Framer Motion

**Ubicación:** `src/components/AnimatedHero.jsx`

```jsx
import { motion } from 'framer-motion';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.2,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.5 },
  },
};

export function AnimatedHero() {
  return (
    <motion.div 
      className="text-center py-20"
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <motion.h1 
        className="text-4xl font-bold"
        variants={itemVariants}
      >
        Bienvenido a LexPro
      </motion.h1>
      
      <motion.p 
        className="text-xl text-slate-600 mt-4"
        variants={itemVariants}
      >
        Asistencia legal con IA
      </motion.p>
      
      <motion.button 
        className="mg-6 px-8 py-3 bg-primary text-white rounded-lg mt-8"
        variants={itemVariants}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        Comenzar
      </motion.button>
    </motion.div>
  );
}
```

**Métodos Framer Motion:**
- `variants`: Define estados de animación
- `initial`: Estado inicial
- `animate`: Estado animado
- `whileHover`: Al pasar mouse
- `whileTap`: Al hacer click
- `whileInView`: Cuando entra en viewport
- `staggerChildren`: Anima hijos secuencialmente
- `transition`: Duración y easing

---

## Diseño Responsivo

**Breakpoints de Tailwind:**

```jsx
export function ResponsiveGrid() {
  return (
    <div className="
      // Mobile (default)
      grid grid-cols-1 gap-4
      // Tablet
      sm:grid-cols-2 sm:gap-6
      // Desktop
      lg:grid-cols-3 lg:gap-8
      // Large Desktop
      xl:grid-cols-4
    ">
      {/* Items */}
    </div>
  );
}
```

**Clases Responsivas:**
- `sm:` - 640px+
- `md:` - 768px+
- `lg:` - 1024px+
- `xl:` - 1280px+
- `2xl:` - 1536px+

---

## Flexbox & Grid

### Flexbox

```jsx
<div className="
  flex                    // Activar flexbox
  flex-row                // Dirección horizontal
  justify-center          // Alinear eje principal (centro)
  items-center            // Alinear eje secundario (centro)
  gap-4                   // Espaciado entre items
">
  {/* Contenido */}
</div>
```

### Grid

```jsx
<div className="
  grid                    // Activar grid
  grid-cols-3             // 3 columnas
  gap-6                   // Espaciado
  auto-rows-max           // Altura automática
">
  {/* Items */}
</div>
```

---

## Paleta de Colores

```jsx
// Uso en elementos
<div className="bg-primary text-white">Primario</div>
<div className="bg-secondary text-white">Secundario</div>
<div className="bg-accent text-slate-900">Acento</div>

// Estados
<button className="bg-primary hover:bg-primary-dark">Hover</button>
<button className="bg-primary focus:ring-2 focus:ring-offset-2">Focus</button>
<button className="bg-primary active:bg-primary-darker">Active</button>

// Opacidades
<div className="bg-primary/50">50% opacidad</div>
<div className="bg-primary/75">75% opacidad</div>
```

---

## Dark Mode

**En tailwind.config.js:**

```js
darkMode: 'class', // usar clase .dark en html
```

**Uso:**

```jsx
<div className="
  bg-white text-black
  dark:bg-slate-900 dark:text-white
">
  Cambia con dark mode
</div>
```

---

## Formularios Estilizados

```jsx
export function FormInput({ label, type = 'text', placeholder }) {
  return (
    <div className="mb-4">
      <label className="block text-slate-700 font-medium mb-2">
        {label}
      </label>
      <input 
        type={type}
        placeholder={placeholder}
        className="
          w-full px-4 py-2
          border border-slate-300 rounded-lg
          focus:outline-none focus:ring-2 focus:ring-primary
          focus:border-transparent
          transition
        "
      />
    </div>
  );
}
```

---

## Sombras & Profundidad

```jsx
// Elevación
<div className="shadow">Sombra base</div>
<div className="shadow-lg">Sombra grande</div>
<div className="shadow-2xl">Sombra extra grande</div>

// Hover effect
<div className="shadow hover:shadow-lg transition-shadow">
  Hover para más sombra
</div>
```

---

## Transiciones & Transformaciones

```jsx
<div className="
  transition-all          // Animar todas las propiedades
  duration-300            // 300ms
  ease-in-out             // Easing function
  
  hover:scale-110         // Zoom al hover
  hover:translate-y-2     // Mover hacia abajo
  hover:rotate-1          // Rotar ligeramente
">
  Hover para efectos
</div>
```

---

## Resumen de Técnicas

| Técnica | Uso |
|---------|-----|
| `flex` / `grid` | Layouts |
| `gap-` | Espaciado |
| `rounded-` | Esquinas |
| `shadow-` | Profundidad |
| `transition-` | Animaciones suaves |
| `hover:` / `focus:` | Estados |
| `sm:` / `md:` | Responsive |
| `dark:` | Dark mode |
| Framer Motion | Animaciones complejas |
| Variantes de colores | Temas consistentes |

---

## ¿Cómo Explicar en Presentación?

1. **Paleta de Colores**: Primary (azul), Secondary (cyan), Accent (ámbar)
2. **Tailwind Basics**: clases utility para estilos rápidos
3. **Componentes Reusables**: Badge, Button, Card con variantes
4. **Framer Motion**: Animaciones suaves al scrollear/hover
5. **Responsividad**: Mobile-first con breakpoints sm/md/lg/xl
6. **Flexbox vs Grid**: Cuándo usar cada uno
7. **Dark Mode**: Soporte para tema oscuro
8. **Flujo Visual**: Colores, animaciones, espaciado coordinados
