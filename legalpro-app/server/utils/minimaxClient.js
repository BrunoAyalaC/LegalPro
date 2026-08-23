import { anonimizarDatosSensibles } from './datosSensibles.js';

export const FunctionCallingConfigMode = {
  ANY: 'ANY',
  AUTO: 'AUTO',
  NONE: 'NONE'
};

export const Type = {
  OBJECT: 'object',
  STRING: 'string',
  NUMBER: 'number',
  ARRAY: 'array',
  BOOLEAN: 'boolean'
};

/**
 * Adaptador para la API de MiniMax (OpenAI Chat Completions compatible).
 * Soporta generación de texto, streaming y function calling.
 */
export class MiniMaxAI {
  constructor({ apiKey }) {
    this.apiKey = apiKey || process.env.MINIMAX_API_KEY;
    this.baseUrl = 'https://api.minimax.io/v1';
    this.models = {
      generateContent: async (params) => {
        return this._generateContent(params);
      },
      generateContentStream: async (params) => {
        return this._generateContentStream(params);
      }
    };
  }

  // Mapea la estructura interna a OpenAI Chat Completions
  _mapParams(params) {
    const model = params.model || process.env.MINIMAX_MODEL_DEFAULT || 'MiniMax-M3';
    const systemInstruction = params.config?.systemInstruction;
    const contents = params.contents || [];
    const messages = [];

    if (systemInstruction) {
      messages.push({ role: 'system', content: systemInstruction });
    }

    function parsePart(part) {
      if (typeof part === 'string') {
        return { type: 'text', text: anonimizarDatosSensibles(part) };
      }
      if (part && part.inlineData) {
        const { mimeType, data } = part.inlineData;
        return {
          type: 'image_url',
          image_url: {
            url: `data:${mimeType};base64,${data}`
          }
        };
      }
      if (part && part.text) {
        return { type: 'text', text: anonimizarDatosSensibles(part.text) };
      }
      return null;
    }

    const isFlatArray = Array.isArray(contents) && contents.every(c => c && !c.parts && c.role === undefined);

    if (isFlatArray) {
      const contentList = [];
      for (const item of contents) {
        const parsed = parsePart(item);
        if (parsed) contentList.push(parsed);
      }
      messages.push({ role: 'user', content: contentList });
    } else {
      for (const c of contents) {
        const role = (c.role === 'model' || c.role === 'assistant') ? 'assistant' : 'user';
        const contentList = [];
        
        const parts = Array.isArray(c.parts) ? c.parts : (c.parts ? [c.parts] : []);
        for (const p of parts) {
          const parsed = parsePart(p);
          if (parsed) contentList.push(parsed);
        }

        if (contentList.length === 1 && contentList[0].type === 'text') {
          messages.push({ role, content: contentList[0].text });
        } else {
          messages.push({ role, content: contentList });
        }
      }
    }

    const payload = {
      model,
      messages,
      temperature: params.config?.temperature ?? 0.2,
      max_tokens: params.config?.maxOutputTokens ?? 4096
    };

    if (params.config?.tools && params.config.tools.length > 0) {
      const tools = [];
      for (const t of params.config.tools) {
        if (t.functionDeclarations) {
          for (const fd of t.functionDeclarations) {
            tools.push({
              type: 'function',
              function: {
                name: fd.name,
                description: fd.description,
                parameters: fd.parametersJsonSchema || fd.parameters
              }
            });
          }
        }
      }
      if (tools.length > 0) {
        payload.tools = tools;
        
        const toolConfig = params.config?.toolConfig;
        if (toolConfig?.functionCallingConfig) {
          const { mode, allowedFunctionNames } = toolConfig.functionCallingConfig;
          if (mode === 'ANY' && allowedFunctionNames && allowedFunctionNames.length > 0) {
            payload.tool_choice = {
              type: 'function',
              function: { name: allowedFunctionNames[0] }
            };
          } else if (mode === 'NONE') {
            payload.tool_choice = 'none';
          } else {
            payload.tool_choice = 'auto';
          }
        }
      }
    }

    // Soporte para response_format (JSON estructurado) — MiniMax M3/M2.5 formato OpenAI
    if (params.config?.responseMimeType === 'application/json' && params.config?.responseSchema) {
      payload.response_format = {
        type: 'json_object',
        schema: params.config.responseSchema
      };
    }

    return payload;
  }

  async _fetchWithRetry(url, options, maxRetries = 3, initialDelay = 1000) {
    let attempt = 0;
    while (true) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(timeoutId);
        if (res.ok) return res;
        
        if (attempt < maxRetries && (res.status === 429 || res.status >= 500)) {
          attempt++;
          const delay = initialDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        return res;
      } catch (err) {
        clearTimeout(timeoutId);
        if (attempt < maxRetries) {
          attempt++;
          const delay = initialDelay * Math.pow(2, attempt);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
        throw err;
      }
    }
  }

  async _generateContent(params) {
    const payload = this._mapParams(params);
    const apiKey = this.apiKey || process.env.MINIMAX_API_KEY;
    const url = `${this.baseUrl}/chat/completions`;

    if (process.env.DEBUG_MINIMAX) {
      console.error('[minimax] URL:', url, 'Model:', payload.model);
    }

    const res = await this._fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      const isHtml = errText.trim().startsWith('<!');
      const detail = isHtml ? `HTML response (check MINIMAX_BASE_URL="${this.baseUrl}")` : errText.slice(0, 200);
      throw new Error(`MiniMax API Error (${res.status}): ${detail}`);
    }

    const data = await res.json();
    const message = data.choices?.[0]?.message || {};
    
    // Si la respuesta fue un tool call
    if (message.tool_calls && message.tool_calls.length > 0) {
      const toolCall = message.tool_calls[0];
      let args = {};
      try {
        args = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        args = { rawArguments: toolCall.function.arguments };
      }
      
      return {
        functionCalls: [{
          name: toolCall.function.name,
          args: args
        }],
        usageMetadata: {
          promptTokenCount: data.usage?.prompt_tokens || 0,
          candidatesTokenCount: data.usage?.completion_tokens || 0,
          totalTokenCount: data.usage?.total_tokens || 0
        }
      };
    }

    // Respuesta normal de texto
    return {
      text: message.content || '',
      usageMetadata: {
        promptTokenCount: data.usage?.prompt_tokens || 0,
        candidatesTokenCount: data.usage?.completion_tokens || 0,
        totalTokenCount: data.usage?.total_tokens || 0
      }
    };
  }

  async _generateContentStream(params) {
    const payload = this._mapParams(params);
    payload.stream = true;
    const apiKey = this.apiKey || process.env.MINIMAX_API_KEY;
    const url = `${this.baseUrl}/chat/completions`;

    const res = await this._fetchWithRetry(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`MiniMax API Error Stream (${res.status}): ${errText}`);
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder('utf-8');

    async function* makeGenerator() {
      let buffer = '';
      const streamTimeout = 60000; // 60s timeout total para el stream
      const streamStart = Date.now();
      try {
        while (true) {
          // Verificar timeout global del stream
          if (Date.now() - streamStart > streamTimeout) {
            throw new Error('MiniMax stream timeout after 60s');
          }
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop();
          
          for (const line of lines) {
            const cleanLine = line.trim();
            if (!cleanLine) continue;
            if (cleanLine.startsWith('data: [DONE]')) {
              break;
            }
            if (cleanLine.startsWith('data: ')) {
              const jsonStr = cleanLine.substring(6);
              try {
                const parsed = JSON.parse(jsonStr);
                const chunkText = parsed.choices?.[0]?.delta?.content || '';
                if (chunkText) {
                  yield {
                    text: chunkText,
                    usageMetadata: parsed.usage ? {
                      promptTokenCount: parsed.usage.prompt_tokens,
                      candidatesTokenCount: parsed.usage.completion_tokens,
                      totalTokenCount: parsed.usage.total_tokens
                    } : null
                  };
                }
              } catch (e) {
                // ignorar chunks mal formados
              }
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    }

    return makeGenerator();
  }
}
