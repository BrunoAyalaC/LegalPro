import { useEffect } from 'react';

/**
 * Hook centralizado para SEO dinámico en páginas frontend.
 *
 * Setea `document.title` y la meta tag `description`. Si se provee `image`,
 * actualiza (o crea) las meta tags Open Graph y Twitter Card equivalentes
 * para que las previsualizaciones sociales se mantengan consistentes.
 *
 * Restaura el `document.title` previo al desmontar el componente.
 *
 * @param {Object}   params
 * @param {string}   params.title       Título que se asignará a `document.title`.
 * @param {string}  [params.description] Descripción para `<meta name="description">` y `og:description`/`twitter:description`.
 * @param {string}  [params.image]      URL absoluta o relativa de la imagen social.
 */
export function useSeo({ title, description, image } = {}) {
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;

    const prevTitle = document.title;
    if (title) {
      document.title = title;
    }

    const upsertMeta = (selector, attr, attrValue, content) => {
      if (!content && content !== 0) return;
      let el = document.head.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(attr, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    if (description) {
      upsertMeta('meta[name="description"]', 'name', 'description', description);
      upsertMeta('meta[property="og:description"]', 'property', 'og:description', description);
      upsertMeta('meta[name="twitter:description"]', 'name', 'twitter:description', description);
    }

    if (image) {
      upsertMeta('meta[property="og:image"]', 'property', 'og:image', image);
      upsertMeta('meta[name="twitter:image"]', 'name', 'twitter:image', image);
    }

    return () => {
      document.title = prevTitle;
    };
  }, [title, description, image]);
}

export default useSeo;
