// Auto-import all icon WebPs from assets/icons/.
// Los PNG originales (~2 MB cada uno) quedan en disco como respaldo de fuente,
// pero NO entran al bundle: el navegador moderno usa WebP y el fallback
// Material Symbol (abajo) cubre navegadores antiguos o iconos sin WebP.
// Reducción: ≈91% del peso de iconos (43 MB → 2 MB en dist).
const iconModules = import.meta.glob('../assets/icons/*.webp', { eager: true });

// Build lookup: "gavel" → "/src/assets/icons/gavel.webp"
const icons = {};
for (const [filePath, mod] of Object.entries(iconModules)) {
  const name = filePath.split('/').pop().replace('.webp', '');
  icons[name] = mod.default;
}

/**
 * AppIcon — Renders a custom icon from the IconosLegalPro collection.
 * Uses <picture> with WebP source + PNG fallback. lazy + async decoding.
 *
 * @param {string} name - Icon name without extension (e.g., "gavel", "analytics")
 * @param {number} size - Icon size in px (default: 24)
 * @param {string} className - Optional extra CSS classes
 * @param {string} alt - Alt text (default: icon name)
 */
export default function AppIcon({ name, size = 24, className = '', alt, style = {} }) {
  const src = icons[name];

  if (!src) {
    // Fallback to Material Symbol if icon WebP not found
    return (
      <span
        className={`material-symbols-outlined ${className}`}
        style={{ fontSize: `${size}px`, ...style }}
      >
        {name}
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt || name}
      className={`app-icon ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        minWidth: `${size}px`,
        minHeight: `${size}px`,
        objectFit: 'contain',
        ...style,
      }}
      loading="lazy"
      decoding="async"
    />
  );
}
