# 👤 PERSONA 1 - Componentes React y Hooks

## Componentes Principales a Explicar

### 1. **Navbar.jsx**
**Ubicación:** `src/components/Navbar.jsx`

```jsx
import { Link } from 'react-router-dom';

export default function Navbar() {
  return (
    <nav className="bg-dark border-b border-slate-700">
      <div className="flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <img 
          src={import.meta.env.BASE_URL + 'logo.png'} 
          alt="Lex.ia" 
          style={{ height: '40px' }}
        />
        
        {/* Links */}
        <div className="flex gap-6">
          <Link to="/" className="text-white">Inicio</Link>
          <Link to="/caracteristicas" className="text-white">Características</Link>
          <Link to="/precios" className="text-white">Precios</Link>
        </div>
        
        {/* CTA Button */}
        <button className="bg-primary text-white px-6 py-2 rounded-lg">
          Prueba Gratis
        </button>
      </div>
    </nav>
  );
}
```

**Métodos usados:**
- `import.meta.env.BASE_URL`: Ruta dinámica para GitHub Pages
- `Link`: Navegación sin recargar página
- Componente **sin estado** (stateless) - solo renderiza

---

### 2. **Hero.jsx**
**Ubicación:** `src/components/Hero.jsx`

```jsx
import { motion } from 'framer-motion';

export default function Hero() {
  return (
    <section className="relative h-screen flex items-center justify-center overflow-hidden">
      {/* Video de fondo */}
      <video 
        className="absolute inset-0 w-full h-full object-cover"
        src={import.meta.env.BASE_URL + 'bg_hero.mp4'}
        autoPlay 
        muted 
        loop
      />
      
      {/* Overlay oscuro */}
      <div className="absolute inset-0 bg-black/50" />
      
      {/* Contenido */}
      <motion.div 
        className="relative z-10 text-center text-white max-w-2xl"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <h1 className="text-5xl font-bold mb-4">
          La <span className="text-secondary">Inteligencia Artificial</span> al servicio de la Justicia
        </h1>
        <p className="text-xl text-slate-300 mb-8">
          Gestiona expedientes, predice resultados y redacta escritos legales con IA avanzada
        </p>
        
        <div className="flex gap-4 justify-center">
          <button className="bg-primary px-8 py-3 rounded-lg font-bold">
            Comienza Gratis
          </button>
          <button className="border border-white px-8 py-3 rounded-lg font-bold">
            Ver Demo
          </button>
        </div>
      </motion.div>
    </section>
  );
}
```

**Métodos usados:**
- `motion.div`: Animación fade-in (Framer Motion)
- `initial/animate`: Estados de animación
- `position: absolute/relative`: Posicionamiento CSS

---

### 3. **Card.jsx** - Componente Reutilizable
**Ubicación:** `src/components/Card.jsx`

```jsx
import { motion } from 'framer-motion';

export function Card({ title, description, icon, color = '#7C3AED' }) {
  return (
    <motion.div 
      className="bg-slate-900 border border-slate-700 rounded-xl p-6 hover:shadow-xl transition"
      style={{ borderLeftColor: color, borderLeftWidth: '4px' }}
      whileHover={{ y: -5 }}
      transition={{ duration: 0.3 }}
    >
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
      <p className="text-slate-400">{description}</p>
    </motion.div>
  );
}
```

**Props:**
- `title` (string): Título de la tarjeta
- `description` (string): Describción
- `icon` (string/component): Ícono
- `color` (hex): Color del borde izquierdo

**Métodos:**
- `whileHover`: Efecto hover en Framer Motion
- Estilos dinámicos con `style` prop

---

### 4. **Feature.jsx** - Componente de Feature Full-Width
**Ubicación:** `src/components/Feature.jsx`

```jsx
import { motion } from 'framer-motion';

export function Feature({ title, description, image, alignment = 'left' }) {
  const isLeft = alignment === 'left';
  
  return (
    <section className="py-20 px-6">
      <div className={`flex items-center gap-12 max-w-6xl mx-auto ${isLeft ? 'flex-row' : 'flex-row-reverse'}`}>
        {/* Texto */}
        <motion.div 
          className="flex-1"
          initial={{ opacity: 0, x: isLeft ? -30 : 30 }}
          whileInView={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl font-bold text-white mb-4">{title}</h2>
          <p className="text-lg text-slate-300">{description}</p>
        </motion.div>
        
        {/* Imagen */}
        <motion.div 
          className="flex-1"
          initial={{ opacity: 0, scale: 0.8 }}
          whileInView={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <img src={image} alt={title} className="rounded-xl shadow-2xl" />
        </motion.div>
      </div>
    </section>
  );
}
```

**Props:**
- `title`, `description`, `image`: Contenido
- `alignment`: 'left' o 'right' para cambiar orden

**Métodos:**
- `whileInView`: Anima cuando entra en viewport
- `flexRow/flexRowReverse`: Cambia orden sin reordenar elementos

---

## Hooks Personalizados

### 5. **useExpedientes() Hook**
**Ubicación:** `src/hooks/useExpedientes.js`

```js
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

export function useExpedientes(usuarioId) {
  const [expedientes, setExpedientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!usuarioId) return;
    
    const obtener = async () => {
      try {
        const { data, error: err } = await supabase
          .from('expedientes')
          .select('*')
          .eq('usuario_id', usuarioId);
        
        if (err) throw err;
        setExpedientes(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    obtener();
  }, [usuarioId]);
  
  return { expedientes, loading, error };
}
```

**Métodos usados:**
- `useState()`: Maneja estado local
- `useEffect()`: Ejecuta código cuando cambia `usuarioId`
- `.select()`: Query de Supabase

**Retorna:** Objeto con datos, loading y errores

---

### 6. **useGemini() Hook**
**Ubicación:** `src/hooks/useGemini.js`

```js
import { useState } from 'react';
import { analizarExpediente, redactarEscrito } from '../services/geminiService';

export function useGemini() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const analizar = async (contenido) => {
    setLoading(true);
    setError(null);
    try {
      const result = await analizarExpediente(contenido);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  const redactar = async (tipo, hechos, pretension) => {
    setLoading(true);
    setError(null);
    try {
      const result = await redactarEscrito(tipo, hechos, pretension);
      return result;
    } catch (err) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };
  
  return { analizar, redactar, loading, error };
}
```

**Métodos:**
- `analizar()`: Llama servicio Gemini para análisis
- `redactar()`: Genera escritos legales
- Maneja loading y errores automáticamente

---

## Resumen de Métodos

| Método | ¿Qué hace? |
|--------|-----------|
| `useState()` | Crea estado local en componentes |
| `useEffect()` | Ejecuta código cuando se monta o depende cambios |
| `import.meta.env.BASE_URL` | Obtiene ruta base dinámicamente |
| `Link to=` | Navega sin recargar |
| `motion.div` | Anima componentes |
| `whileHover/whileInView` | Triggersde animaciones |
| `supabase.from().select()` | Lee datos de BD |
| `.eq()` | Filtra por igualdad |

---

## ¿Cómo Explicar en Presentación?

1. **Navbar**: Muestra estructura y explica `BASE_URL` para GitHub Pages
2. **Hero**: Explica animaciones básicas y video de fondo
3. **Card**: Demuestra componentes reutilizables con props
4. **Feature**: Explica `whileInView` y layout dinámico
5. **Hooks**: Explica separación de lógica y reutilización
6. **useExpedientes**: Flujo de datos desde Supabase
7. **useGemini**: Integración con IA y manejo de promesas
