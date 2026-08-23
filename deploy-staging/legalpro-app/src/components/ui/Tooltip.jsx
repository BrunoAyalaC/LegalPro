/**
 * Tooltip — Popover flotante con posición automática.
 * Usa estado hover + posición absoluta relativa al wrapper.
 */
import { useState, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';

const positionVariants = {
  top: {
    initial:  { opacity: 0, y: 4,  scale: 0.95 },
    animate:  { opacity: 1, y: 0,  scale: 1 },
    exit:     { opacity: 0, y: 4,  scale: 0.95 },
  },
  bottom: {
    initial:  { opacity: 0, y: -4, scale: 0.95 },
    animate:  { opacity: 1, y: 0,  scale: 1 },
    exit:     { opacity: 0, y: -4, scale: 0.95 },
  },
  left: {
    initial:  { opacity: 0, x: 4,  scale: 0.95 },
    animate:  { opacity: 1, x: 0,  scale: 1 },
    exit:     { opacity: 0, x: 4,  scale: 0.95 },
  },
  right: {
    initial:  { opacity: 0, x: -4, scale: 0.95 },
    animate:  { opacity: 1, x: 0,  scale: 1 },
    exit:     { opacity: 0, x: -4, scale: 0.95 },
  },
};

const OFFSET = 8;

function computeStyle(rect, position) {
  if (!rect) return {};
  switch (position) {
    case 'top':    return { bottom: window.innerHeight - rect.top + OFFSET, left: rect.left + rect.width / 2 };
    case 'bottom': return { top: rect.bottom + OFFSET, left: rect.left + rect.width / 2 };
    case 'left':   return { top: rect.top + rect.height / 2, right: window.innerWidth - rect.left + OFFSET };
    case 'right':  return { top: rect.top + rect.height / 2, left: rect.right + OFFSET };
    default:       return {};
  }
}

function computeTransform(position) {
  switch (position) {
    case 'top':    return 'translate(-50%, 0)';
    case 'bottom': return 'translate(-50%, 0)';
    case 'left':   return 'translate(0, -50%)';
    case 'right':  return 'translate(0, -50%)';
    default:       return '';
  }
}

export default function Tooltip({
  content,
  children,
  position = 'top',
  delay = 300,
  disabled = false,
  maxWidth = 200,
}) {
  const [visible, setVisible] = useState(false);
  const [rect, setRect]       = useState(null);
  const timerRef              = useRef(null);
  const wrapRef               = useRef(null);

  const show = useCallback(() => {
    if (disabled) return;
    timerRef.current = setTimeout(() => {
      if (wrapRef.current) setRect(wrapRef.current.getBoundingClientRect());
      setVisible(true);
    }, delay);
  }, [disabled, delay]);

  const hide = useCallback(() => {
    clearTimeout(timerRef.current);
    setVisible(false);
  }, []);

  const style = computeStyle(rect, position);
  const transform = computeTransform(position);
  const variants = positionVariants[position] ?? positionVariants.top;

  return (
    <span
      ref={wrapRef}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="inline-flex"
    >
      {children}

      {createPortal(
        <AnimatePresence>
          {visible && content && (
            <motion.div
              key="tooltip"
              role="tooltip"
              variants={variants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.15 }}
              className="fixed z-[300] pointer-events-none"
              style={{ ...style, transform, maxWidth }}
            >
              <div className="px-2.5 py-1.5 rounded-lg text-xs text-white bg-slate-800
                border border-white/15 shadow-xl shadow-black/40 leading-relaxed
                backdrop-blur-xl whitespace-nowrap">
                {content}
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </span>
  );
}
