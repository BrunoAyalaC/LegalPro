# 🔌 FRONTEND - Servicios y API (Personas 1-2)

## Capa de Servicios

### 1. **Supabase Client Service**
**Ubicación:** `src/services/supabaseClient.js`
**Responsables:** Personas 1-2

#### Inicialización
```js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

#### Métodos
```js
// 1. Autenticación
export async function loginUser(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
}

// 2. Registro
export async function registerUser(email, password, userData) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: userData }
  });
  return { data, error };
}

// 3. Logout
export async function logoutUser() {
  await supabase.auth.signOut();
}

// 4. Obtener usuario actual
export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
```

---

### 2. **Expedientes Service**
**Ubicación:** `src/services/expedientesService.js`
**Responsables:** Personas 1-2

#### CRUD Operations
```js
import { supabase } from './supabaseClient';

// CREATE
export async function crearExpediente(expediente) {
  const { data, error } = await supabase
    .from('expedientes')
    .insert([expediente])
    .select();
  return { data, error };
}

// READ (obtener uno)
export async function obtenerExpediente(id) {
  const { data, error } = await supabase
    .from('expedientes')
    .select('*')
    .eq('id', id)
    .single();
  return { data, error };
}

// READ (lista con filtros)
export async function listarExpedientes(usuarioId, filtros = {}) {
  let query = supabase
    .from('expedientes')
    .select('*')
    .eq('usuario_id', usuarioId);
  
  if (filtros.materia) {
    query = query.eq('materia', filtros.materia);
  }
  
  const { data, error } = await query;
  return { data, error };
}

// UPDATE
export async function actualizarExpediente(id, cambios) {
  const { data, error } = await supabase
    .from('expedientes')
    .update(cambios)
    .eq('id', id)
    .select();
  return { data, error };
}

// DELETE
export async function eliminarExpediente(id) {
  const { error } = await supabase
    .from('expedientes')
    .delete()
    .eq('id', id);
  return { error };
}
```

---

### 3. **Gemini API Service**
**Ubicación:** `src/services/geminiService.js`
**Responsables:** Personas 1-2

#### Integración con Google Gemini
```js
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });

// Análisis de expediente
export async function analizarExpediente(contenidoExpediente) {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: `Analiza este expediente y proporciona: 1) Resumen, 2) Fortalezas, 3) Debilidades\n\n${contenidoExpediente}`,
      config: {
        systemInstruction: 'Eres un abogado peruano experto. Analiza casos legales.',
      }
    });
    
    return { text: response.text() };
  } catch (error) {
    return { error: error.message };
  }
}

// Redacción de escritos
export async function redactarEscrito(tipo, hechos, pretension) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Redacta una ${tipo} con los siguientes hechos: ${hechos}\nPretensión: ${pretension}`,
  });
  
  return { text: response.text() };
}

// Predicción judicial
export async function predecirResultado(hechos, contextoJurisprudencia) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Basándote en la jurisprudencia peruana, predice el resultado probable de este caso:\n${hechos}`,
  });
  
  return { prediction: response.text() };
}
```

---

### 4. **API Backend Service**
**Ubicación:** `src/services/apiService.js`
**Responsables:** Personas 1-2

#### Cliente HTTP REST
```js
const API_BASE_URL = import.meta.env.VITE_API_URL;

export async function apiCall(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token');
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });
  
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }
  
  return response.json();
}

// GET
export async function obtener(endpoint) {
  return apiCall(endpoint, { method: 'GET' });
}

// POST
export async function crear(endpoint, datos) {
  return apiCall(endpoint, {
    method: 'POST',
    body: JSON.stringify(datos)
  });
}

// PUT
export async function actualizar(endpoint, datos) {
  return apiCall(endpoint, {
    method: 'PUT',
    body: JSON.stringify(datos)
  });
}

// DELETE
export async function eliminar(endpoint) {
  return apiCall(endpoint, { method: 'DELETE' });
}
```

---

### 5. **Hooks Personalizados para Servicios**
**Ubicación:** `src/hooks/useExpedientes.js`
**Responsables:** Personas 1-2

#### Hook para gestionar expedientes
```js
import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';

export function useExpedientes(usuarioId) {
  const [expedientes, setExpedientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    const obtener = async () => {
      try {
        const { data, error } = await supabase
          .from('expedientes')
          .select('*')
          .eq('usuario_id', usuarioId);
        
        if (error) throw error;
        setExpedientes(data);
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

#### Hook para Gemini
```js
export function useGemini() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  const analizar = async (contenido) => {
    setLoading(true);
    try {
      const { text, error: err } = await analizarExpediente(contenido);
      if (err) throw err;
      return text;
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  return { analizar, loading, error };
}
```

---

## Flujo de Datos: Frontend → Backend

```
Component
  ↓
useExpedientes Hook
  ↓
expedientesService.listarExpedientes()
  ↓
supabase.from('expedientes').select()
  ↓
PostgreSQL (Supabase)
  ↓
Respuesta JSON
  ↓
Component State Update
  ↓
Re-render
```

---

## Variables de Entorno (.env)
```
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_GEMINI_API_KEY=AIza...
VITE_API_URL=https://backend.railway.app/api
```

---

## Error Handling Estándar
```js
try {
  const { data, error } = await supabase.from('tabla').select();
  if (error) throw error;
  return data;
} catch (error) {
  console.error('Error:', error.message);
  return null;
}
```

---

## Rate Limiting
- **Supabase:** 500 requests/segundo por proyecto
- **Gemini API:** Límites según plan (free/paid)
- **Backend Railway:** Escalable automáticamente
