import { useState, useRef, useCallback } from 'react';

/**
 * Gestión de drag & drop para upload de archivos.
 * @param {Function} onDrop - Callback con FileList
 * @param {{ accept?: string[], maxSizeMB?: number }} options
 */
export function useFileDrop(onDrop, options = {}) {
  const { accept = [], maxSizeMB = 50 } = options;
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState(null);
  const dragCounter = useRef(0);

  const validateFile = useCallback((file) => {
    if (accept.length > 0) {
      const ext = '.' + file.name.split('.').pop().toLowerCase();
      const mime = file.type;
      if (!accept.some((a) => a === ext || a === mime)) {
        return `Tipo no permitido: ${ext}`;
      }
    }
    if (file.size > maxSizeMB * 1024 * 1024) {
      return `Archivo demasiado grande (máx. ${maxSizeMB}MB)`;
    }
    return null;
  }, [accept, maxSizeMB]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    setError(null);

    const files = Array.from(e.dataTransfer.files);
    const errors = files.map(validateFile).filter(Boolean);

    if (errors.length > 0) {
      setError(errors[0]);
      return;
    }

    onDrop?.(files);
  }, [onDrop, validateFile]);

  const handleInputChange = useCallback((e) => {
    const files = Array.from(e.target.files ?? []);
    const errors = files.map(validateFile).filter(Boolean);

    if (errors.length > 0) {
      setError(errors[0]);
      return;
    }

    onDrop?.(files);
    e.target.value = '';
  }, [onDrop, validateFile]);

  return {
    isDragging,
    error,
    setError,
    dropZoneProps: {
      onDragEnter: handleDragEnter,
      onDragLeave: handleDragLeave,
      onDragOver: handleDragOver,
      onDrop: handleDrop,
    },
    inputProps: {
      onChange: handleInputChange,
      type: 'file',
      multiple: true,
      accept: accept.join(','),
      className: 'sr-only',
    },
  };
}
