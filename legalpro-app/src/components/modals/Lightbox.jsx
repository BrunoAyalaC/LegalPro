/**
 * Lightbox — Visor full-screen de documentos e imágenes.
 * Soporta: imágenes, PDFs (iframe), navegación prev/next.
 */
import { useEffect, useCallback, useState, startTransition } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut,
  RotateCw, Maximize2, FileText,
} from 'lucide-react';

const overlayVariants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25 } },
  exit:    { opacity: 0, transition: { duration: 0.2 } },
};

const contentVariants = {
  initial: { opacity: 0, scale: 0.92 },
  animate: { opacity: 1, scale: 1,  transition: { duration: 0.3, ease: [0.34, 1.2, 0.64, 1] } },
  exit:    { opacity: 0, scale: 0.96, transition: { duration: 0.2 } },
};

function isPDF(src = '') {
  return src.toLowerCase().includes('.pdf') || src.toLowerCase().startsWith('data:application/pdf');
}

export default function Lightbox({
  open = false,
  onClose,
  items = [],      // [{ src, title, type }]
  initialIndex = 0,
}) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom]   = useState(1);
  const [rotate, setRotate] = useState(0);

  useEffect(() => {
    if (open) { startTransition(() => { setIndex(initialIndex); setZoom(1); setRotate(0); }); }
  }, [open, initialIndex]);

  const current = items[index];
  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  const prev = useCallback(() => { if (hasPrev) { setIndex(i => i - 1); setZoom(1); setRotate(0); } }, [hasPrev]);
  const next = useCallback(() => { if (hasNext) { setIndex(i => i + 1); setZoom(1); setRotate(0); } }, [hasNext]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape')     onClose?.();
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, prev, next]);

  if (!current) return null;

  const isDoc = isPDF(current.src);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="lightbox-overlay"
          variants={overlayVariants}
          initial="initial" animate="animate" exit="exit"
          className="fixed inset-0 z-[400] bg-black/92 backdrop-blur-sm
            flex flex-col items-center justify-center"
          onClick={onClose}
        >
          {/* ── Toolbar ── */}
          <div
            onClick={e => e.stopPropagation()}
            className="absolute top-0 left-0 right-0 flex items-center justify-between
              px-4 py-3 bg-linear-to-b from-black/60 to-transparent z-10"
          >
            <span className="text-sm font-medium text-white truncate max-w-[50%]">
              {current.title ?? `Documento ${index + 1} de ${items.length}`}
            </span>
            <div className="flex items-center gap-2">
              {/* Zoom — solo imágenes */}
              {!isDoc && (
                <>
                  <ToolBtn onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} label="Reducir"><ZoomOut size={16} /></ToolBtn>
                  <span className="text-xs text-slate-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
                  <ToolBtn onClick={() => setZoom(z => Math.min(4, z + 0.25))}  label="Ampliar"><ZoomIn size={16} /></ToolBtn>
                  <ToolBtn onClick={() => setRotate(r => (r + 90) % 360)} label="Rotar"><RotateCw size={16} /></ToolBtn>
                </>
              )}
              {current.src && (
                <a
                  href={current.src}
                  download
                  onClick={e => e.stopPropagation()}
                  className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
                  aria-label="Descargar"
                >
                  <Download size={16} />
                </a>
              )}
              <ToolBtn onClick={onClose} label="Cerrar"><X size={16} /></ToolBtn>
            </div>
          </div>

          {/* ── Contenido ── */}
          <motion.div
            key={index}
            variants={contentVariants}
            initial="initial" animate="animate" exit="exit"
            onClick={e => e.stopPropagation()}
            className="relative flex items-center justify-center
              max-w-[90vw] max-h-[80vh] w-full overflow-hidden"
          >
            {isDoc ? (
              <div className="flex flex-col items-center gap-4">
                <FileText size={64} className="text-slate-500" />
                <p className="text-slate-400 text-sm">{current.title ?? 'Documento PDF'}</p>
                <iframe
                  src={current.src}
                  title={current.title}
                  className="w-[80vw] h-[65vh] rounded-xl border border-white/10"
                />
              </div>
            ) : (
              <img
                src={current.src}
                alt={current.title ?? 'Imagen'}
                draggable={false}
                className="max-w-full max-h-[80vh] rounded-xl object-contain select-none transition-transform duration-200"
                style={{ transform: `scale(${zoom}) rotate(${rotate}deg)` }}
              />
            )}
          </motion.div>

          {/* ── Navegación ── */}
          {hasPrev && (
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              aria-label="Anterior"
              className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-2xl
                bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          {hasNext && (
            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              aria-label="Siguiente"
              className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-2xl
                bg-white/10 hover:bg-white/20 text-white transition-colors backdrop-blur-sm"
            >
              <ChevronRight size={22} />
            </button>
          )}

          {/* ── Dots ── */}
          {items.length > 1 && (
            <div className="absolute bottom-4 flex gap-1.5" onClick={e => e.stopPropagation()}>
              {items.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  aria-label={`Ver documento ${i + 1}`}
                  className={`h-1.5 rounded-full transition-all duration-200 ${i === index ? 'w-5 bg-white' : 'w-1.5 bg-white/30 hover:bg-white/50'}`}
                />
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

function ToolBtn({ children, onClick, label }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
    >
      {children}
    </button>
  );
}
