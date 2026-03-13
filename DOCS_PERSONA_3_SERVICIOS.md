# 👤 PERSONA 3 - Servicios & Integraciones API

## Estructura de Servicios

**Carpeta:** `src/services/`

```
src/services/
├── supabaseClient.js        ← Conexión a BD
├── expedientesService.js    ← CRUD expedientes
├── geminiService.js         ← Integración IA
├── apiService.js            ← HTTP requests
```

---

## 1. Cliente Supabase

**Ubicación:** `src/services/supabaseClient.js`

```js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

**Métodos:**
- `createClient(URL, KEY)`: Inicializa cliente
- `supabase.from()`: Acceso a tablas
- `supabase.auth`: Autenticación

---

## 2. Servicio CRUD de Expedientes

**Ubicación:** `src/services/expedientesService.js`

```js
import { supabase } from './supabaseClient';

// 📖 READ - Obtener expedientes del usuario
export async function obtenerExpedientes(usuarioId) {
  const { data, error } = await supabase
    .from('expedientes')
    .select('*')
    .eq('usuario_id', usuarioId)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('Error al obtener expedientes:', error);
    return [];
  }
  
  return data;
}

// 📖 READ - Obtener expediente por ID
export async function obtenerExpedienteById(expedienteId) {
  const { data, error } = await supabase
    .from('expedientes')
    .select('*')
    .eq('id', expedienteId)
    .single();
  
  if (error) {
    console.error('Error al obtener expediente:', error);
    return null;
  }
  
  return data;
}

// ✍️ CREATE - Crear nuevo expediente
export async function crearExpediente(expediente) {
  const { data, error } = await supabase
    .from('expedientes')
    .insert([expediente])
    .select();
  
  if (error) {
    console.error('Error al crear expediente:', error);
    return null;
  }
  
  return data[0];
}

// 🔄 UPDATE - Actualizar expediente
export async function actualizarExpediente(expedienteId, updates) {
  const { data, error } = await supabase
    .from('expedientes')
    .update(updates)
    .eq('id', expedienteId)
    .select();
  
  if (error) {
    console.error('Error al actualizar expediente:', error);
    return null;
  }
  
  return data[0];
}

// 🗑️ DELETE - Eliminar expediente
export async function eliminarExpediente(expedienteId) {
  const { error } = await supabase
    .from('expedientes')
    .delete()
    .eq('id', expedienteId);
  
  if (error) {
    console.error('Error al eliminar expediente:', error);
    return false;
  }
  
  return true;
}

// 🔍 Búsqueda por texto
export async function buscarExpedientes(usuarioId, query) {
  const { data, error } = await supabase
    .from('expedientes')
    .select('*')
    .eq('usuario_id', usuarioId)
    .or(`numero.ilike.%${query}%,titulo.ilike.%${query}%`)
    .limit(20);
  
  if (error) {
    console.error('Error en búsqueda:', error);
    return [];
  }
  
  return data;
}
```

**Métodos Supabase Utilizados:**
- `.from('table')`: Selecciona tabla
- `.select('*')`: Obtiene todas las columnas
- `.eq('column', value)`: WHERE column = value
- `.or()`: WHERE ... OR ...
- `.order('column', {ascending})`: ORDER BY
- `.insert()`: INSERT
- `.update()`: UPDATE
- `.delete()`: DELETE
- `.single()`: Una fila
- `.limit(20)`: LIMIT

---

## 3. Hook Custom - useExpedientes

**Ubicación:** `src/hooks/useExpedientes.js`

```js
import { useState, useEffect } from 'react';
import { 
  obtenerExpedientes, 
  crearExpediente, 
  actualizarExpediente, 
  eliminarExpediente 
} from '../services/expedientesService';

export function useExpedientes(usuarioId) {
  const [expedientes, setExpedientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Cargar expedientes al montar
  useEffect(() => {
    async function cargar() {
      const data = await obtenerExpedientes(usuarioId);
      setExpedientes(data);
      setLoading(false);
    }
    cargar();
  }, [usuarioId]);
  
  // CREATE
  const agregar = async (expediente) => {
    const nuevo = await crearExpediente(expediente);
    if (nuevo) {
      setExpedientes([nuevo, ...expedientes]);
    }
    return nuevo;
  };
  
  // UPDATE
  const actualizar = async (expedienteId, updates) => {
    const actualizado = await actualizarExpediente(expedienteId, updates);
    if (actualizado) {
      setExpedientes(expedientes.map(e => 
        e.id === expedienteId ? actualizado : e
      ));
    }
    return actualizado;
  };
  
  // DELETE
  const eliminar = async (expedienteId) => {
    const exito = await eliminarExpediente(expedienteId);
    if (exito) {
      setExpedientes(expedientes.filter(e => e.id !== expedienteId));
    }
    return exito;
  };
  
  return { expedientes, loading, error, agregar, actualizar, eliminar };
}
```

**Uso en componente:**

```jsx
import { useExpedientes } from '../hooks/useExpedientes';

export default function MisExpedientes({ usuarioId }) {
  const { expedientes, loading, agregar, eliminar } = useExpedientes(usuarioId);
  
  if (loading) return <div>Cargando...</div>;
  
  return (
    <div>
      {expedientes.map(exp => (
        <div key={exp.id}>
          <h3>{exp.titulo}</h3>
          <button onClick={() => eliminar(exp.id)}>Eliminar</button>
        </div>
      ))}
    </div>
  );
}
```

---

## 4. Integración Google Gemini

**Ubicación:** `src/services/geminiService.js`

```js
import { GoogleGenAI } from '@google/genai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });

// Analizar expediente con IA
export async function analizarExpediente(expediente) {
  const prompt = `
    Eres un abogado peruano experto. Analiza este expediente:
    
    Número: ${expediente.numero}
    Tipo: ${expediente.tipo}
    Descripción: ${expediente.descripcion}
    
    Proporciona:
    1. Resumen legal
    2. Riesgos identificados
    3. Recomendaciones
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 500,
      },
    });
    
    return response.response.text();
  } catch (error) {
    console.error('Error en análisis IA:', error);
    return null;
  }
}

// Generar demanda con IA
export async function generarDemanda(datosExpediente) {
  const prompt = `
    Genera una demanda legal basada en:
    Demandante: ${datosExpediente.demandante}
    Demandado: ${datosExpediente.demandado}
    Hechos: ${datosExpediente.hechos}
    Pretensión: ${datosExpediente.pretension}
  `;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.response.text();
  } catch (error) {
    console.error('Error generando demanda:', error);
    return null;
  }
}

// Conversación con IA (chatbot)
export async function chatLegal(mensaje, contexto = '') {
  const prompt = contexto 
    ? `${contexto}\n\nPregunta: ${mensaje}`
    : mensaje;
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    
    return response.response.text();
  } catch (error) {
    console.error('Error en chat:', error);
    return null;
  }
}
```

---

## 5. Hook Custom - useGemini

**Ubicación:** `src/hooks/useGemini.js`

```js
import { useState } from 'react';
import { analizarExpediente, generarDemanda, chatLegal } from '../services/geminiService';

export function useGemini() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const analizar = async (expediente) => {
    setLoading(true);
    setError(null);
    
    const resultado = await analizarExpediente(expediente);
    setLoading(false);
    
    if (!resultado) {
      setError('Error al analizar expediente');
    }
    
    return resultado;
  };
  
  const generar = async (datosExpediente) => {
    setLoading(true);
    setError(null);
    
    const demanda = await generarDemanda(datosExpediente);
    setLoading(false);
    
    if (!demanda) {
      setError('Error al generar demanda');
    }
    
    return demanda;
  };
  
  const chat = async (mensaje, contexto) => {
    setLoading(true);
    setError(null);
    
    const respuesta = await chatLegal(mensaje, contexto);
    setLoading(false);
    
    if (!respuesta) {
      setError('Error en chat');
    }
    
    return respuesta;
  };
  
  return { analizar, generar, chat, loading, error };
}
```

**Uso:**

```jsx
import { useGemini } from '../hooks/useGemini';

export function AnalizarExpedienteBtn({ expediente }) {
  const { analizar, loading } = useGemini();
  
  const handleClick = async () => {
    const resultado = await analizar(expediente);
    console.log(resultado);
  };
  
  return (
    <button onClick={handleClick} disabled={loading}>
      {loading ? 'Analizando...' : 'Analizar con IA'}
    </button>
  );
}
```

---

## 6. API Service - HTTP Requests

**Ubicación:** `src/services/apiService.js`

```js
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

// GET
export async function fetchAPI(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
  });
  
  if (!response.ok) {
    throw new Error(`Error ${response.status}: ${response.statusText}`);
  }
  
  return response.json();
}

// POST
export async function postAPI(endpoint, data) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getAuthToken()}`,
    },
    body: JSON.stringify(data),
  });
  
  if (!response.ok) {
    throw new Error(`Error ${response.status}`);
  }
  
  return response.json();
}

// Obtener token de auth
function getAuthToken() {
  return localStorage.getItem('auth_token') || '';
}
```

**Uso:**

```js
// GET
const usuarios = await fetchAPI('/api/usuarios');

// POST
const nuevo = await postAPI('/api/expedientes', {
  titulo: 'Mi Expediente',
  tipo: 'Penal',
});
```

---

## Resumen de Servicios

| Servicio | Función |
|----------|---------|
| `supabaseClient.js` | Conexión BD |
| `expedientesService.js` | CRUD expedientes |
| `geminiService.js` | IA análisis/generación |
| `apiService.js` | HTTP requests |
| `useExpedientes()` | Hook CRUD |
| `useGemini()` | Hook IA |

---

## Variables de Entorno

**Ubicación:** `.env.local`

```env
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_GEMINI_API_KEY=AIza...
VITE_API_BASE_URL=http://localhost:3000
```

---

## ¿Cómo Explicar en Presentación?

1. **Supabase**: BD en la nube, no SQL server local
2. **CRUD**: Create, Read, Update, Delete
3. **Hooks Custom**: Encapsulan lógica de servicios
4. **Gemini**: IA generativa para análisis legal
5. **Flujo**: Componente → Hook → Servicio → BD/API
6. **Error Handling**: try/catch y estados
7. **Security**: JWT en Authorization header
8. **Variables de Entorno**: Separar secrets
