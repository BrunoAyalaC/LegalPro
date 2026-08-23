// legalpro-app/src/components/chat/Mensaje.jsx
// Burbuja individual del chat LexIA. Extraído con React.memo para que
// mensajes antiguos NO se re-rendericen cuando solo cambia el último.
//
// Contrato:
//   - Toda dependencia externa (estado, handlers, contexto) se pasa por prop.
//   - El padre (ChatIA.jsx) garantiza que los handlers sean estables
//     (useCallback) para que React.memo no se invalide por referencia.
//   - Si las props son iguales, el componente no re-renderiza.

import { memo } from 'react';
import DOMPurify from 'dompurify';
import AppIcon from '../AppIcon';
import TarjetaRespuesta from './TarjetaRespuesta';
import { mdToHtml } from './LegalMarkdown';

// Sanitización del markdown legal renderizado (ver LegalMarkdown.jsx).
const LEGAL_MD_SANITIZE = {
  ALLOWED_TAGS: [
    'strong', 'em', 'br', 'span', 'div', 'p',
    'table', 'thead', 'tbody', 'tr', 'th', 'td',
    'blockquote', 'hr', 'ul', 'ol', 'li', 'code',
  ],
  ALLOWED_ATTR: ['class'],
};

function MensajeImpl({
  msg,
  index,
  avatarIA,
  leyesExpandidas,
  onToggleLeyes,
  onCopy,
  onDownload,
}) {
  const isUser = msg.role === 'user';

  return (
    <div
      className={`flex gap-2.5 anim-fade-in-up ${
        isUser ? 'justify-end' : 'justify-start'
      }`}
    >
      {!isUser ? (
        <img
          src={avatarIA}
          alt="LexIA"
          loading="lazy"
          decoding="async"
          className="ai-avatar w-8 h-8 sm:w-9 sm:h-9 shrink-0 mt-0.5"
        />
      ) : (
        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center shrink-0 mt-0.5 order-2">
          <AppIcon name="person" size={18} className="text-indigo-200" />
        </div>
      )}

      <div
        className={`flex flex-col gap-1 min-w-0 ${
          isUser
            ? 'items-end max-w-[85%] sm:max-w-[75%] order-1'
            : 'items-start max-w-[88%] sm:max-w-[80%]'
        }`}
      >
        <div
          className={`group relative p-3 sm:p-3.5 rounded-2xl break-words ${
            isUser
              ? 'chat-user rounded-br-md text-white inline-block max-w-full'
              : msg.isError
                ? 'bg-red-500/10 border border-red-500/25 text-red-200 rounded-bl-md w-full'
                : 'chat-ai rounded-bl-md w-full'
          }`}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.text}</p>
          ) : (
            <>
              <TarjetaRespuesta
                respuesta={msg.raw || { respuesta: msg.text, tipo_respuesta: 'respuesta', data: { leyes: msg.leyes } }}
                onDownload={onDownload}
              />
              {(!msg.raw || msg.tipoRespuesta === 'respuesta' || !msg.tipoRespuesta) && (
                <div
                  className="chat-ai-content text-sm leading-relaxed text-slate-200"
                  dangerouslySetInnerHTML={{
                    __html: DOMPurify.sanitize(mdToHtml(msg.text), LEGAL_MD_SANITIZE),
                  }}
                />
              )}
            </>
          )}

          {!isUser && !msg.isError && (
            <div className="mt-2.5 pt-2 border-t border-white/8 flex items-center justify-between gap-2 flex-wrap">
              <p className="text-[10px] text-amber-400/70 flex items-center gap-1">
                <AppIcon name="warning" size={10} />
                Borrador IA — requiere revisión profesional
              </p>
              <button
                type="button"
                onClick={() => onCopy(msg.text)}
                className="sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100 text-[10px] text-slate-400 hover:text-cyan-300 flex items-center gap-1 transition-opacity"
                aria-label="Copiar respuesta"
              >
                <AppIcon name="content_copy" size={12} /> Copiar
              </button>
            </div>
          )}

          {msg.leyes?.length > 0 && (
            <div className="mt-2 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => onToggleLeyes(index)}
                className="text-xs text-slate-400 hover:text-cyan-400 flex items-center gap-1"
              >
                <AppIcon name="gavel" size={14} />
                Base legal ({msg.leyes.length})
                <AppIcon name={leyesExpandidas ? 'expand_less' : 'expand_more'} size={14} />
              </button>
              {leyesExpandidas && (
                <div className="mt-2 pl-2 border-l-2 border-cyan-500/40 space-y-1">
                  {msg.leyes.map((ley, li) => (
                    <p key={li} className="text-[11px] text-slate-400">
                      <span className="text-cyan-400">{ley.norma}</span>
                      {ley.articulos && ` — Art. ${ley.articulos}`}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <span
          className={`text-[10px] text-slate-500 px-1 ${isUser ? 'text-right' : ''}`}
        >
          {msg.time}
        </span>
      </div>
    </div>
  );
}

// React.memo con comparación por defecto (shallow de props).
// Mientras msg/avatarIA sean referencias estables y onToggleLeyes/onCopy/onDownload
// provengan de useCallback, el componente evita re-render cuando solo cambia
// el último mensaje del historial.
const Mensaje = memo(MensajeImpl);
Mensaje.displayName = 'Mensaje';

export default Mensaje;
