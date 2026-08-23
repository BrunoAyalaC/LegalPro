/** Corrige mojibake típico (UTF-8 leído como Latin-1): GarcÃa → García */
export function fixUtf8Mojibake(text) {
  if (!text || typeof text !== 'string' || !/Ã|�/.test(text)) return text;
  try {
    const bytes = Uint8Array.from([...text].map((c) => c.charCodeAt(0) & 0xff));
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    return text;
  }
}
