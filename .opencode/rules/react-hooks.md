---
description: Reglas para React Hooks
globs:
  - "legalpro-app/src/hooks/*.js"
  - "legalpro-app/src/hooks/*.ts"
  - "legalpro-app/src/**/*.{jsx,tsx}"
---

# Reglas de React Hooks

Aplicar estas reglas al escribir o usar hooks en React.

## Reglas de Hooks (eslint-plugin-react-hooks)

- SIEMPRE llamar hooks en el top level (NO dentro de loops, condiciones, funciones anidadas)
- SIEMPRE llamar hooks en el mismo orden entre renders
- SIEMPRE hooks custom con prefijo `use`

## Dependencias de useEffect

- SIEMPRE declarar TODAS las dependencias usadas en el array
- NUNCA omitir dependencias (causa bugs sutiles)
- NUNCA usar objetos/funciones inline (causa re-renders infinitos)

## Custom Hooks

```js
function useDebounce(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}
```

## Performance

- `useMemo` para cálculos pesados
- `useCallback` para funciones pasadas a componentes memoizados
- `useRef` para valores mutables que no causan re-render

## Async

- SIEMPRE limpiar subscriptions en cleanup
- SIEMPRE usar AbortController para fetch
- SIEMPRE manejar errores

## Common Hooks del Proyecto

- `useDebounce` - debouncing de input
- `useLocalStorage` - persistencia local
- `useOnClickOutside` - cerrar dropdowns
- `useKeyboard` / `useCmdK` - shortcuts
- `useCountUp` - animaciones numéricas
- `useMediaQuery` / `useIsMobile` - responsive
- `useDisclosure` - modales
- `useFocusTrap` - accesibilidad
- `useFileDrop` - drag and drop
