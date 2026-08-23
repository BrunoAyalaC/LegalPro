// legalpro-app/server/adapters/GeminiAdapter.js
// Generado por @backend-node (Sprint 1 - Tarea 8)
// Adapter de Gemini con I/F IGeminiService (catalogs/adaptadores.json)

import { GoogleGenAI } from '@google/genai';

export class GeminiAdapter {
  constructor(apiKey, model = 'gemini-2.5-flash') {
    if (!apiKey) throw new Error('Gemini API key required');
    this.ai = new GoogleGenAI({ apiKey });
    this.model = model;
    this.circuitOpen = false;
    this.circuitOpenUntil = 0;
    this.consecutiveErrors = 0;
  }

  async generateContent({ prompt, systemInstruction, tools, temperature = 0.2, maxTokens = 8192, useGrounding = false }) {
    if (this.circuitOpen && Date.now() < this.circuitOpenUntil) {
      throw new Error('Gemini circuit breaker OPEN - cache fallback');
    }

    try {
      const config = {
        systemInstruction,
        temperature,
        maxOutputTokens: maxTokens,
        tools: tools ? [{ functionDeclarations: tools }] : undefined
      };
      if (useGrounding) {
        config.tools = [...(config.tools || []), { googleSearch: {} }];
      }

      const response = await this.ai.models.generateContent({
        model: this.model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config
      });

      this.consecutiveErrors = 0;
      this.circuitOpen = false;
      return this._parseResponse(response);
    } catch (e) {
      this.consecutiveErrors++;
      if (this.consecutiveErrors >= 5) {
        this.circuitOpen = true;
        this.circuitOpenUntil = Date.now() + 60000;
        console.warn('[GeminiAdapter] Circuit breaker OPEN por 60s');
      }
      throw e;
    }
  }

  _parseResponse(response) {
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const functionCalls = response.candidates?.[0]?.content?.parts?.filter(p => p.functionCall).map(p => p.functionCall);
    const usage = response.usageMetadata || {};
    return {
      text,
      functionCalls,
      tokensInput: usage.promptTokenCount || 0,
      tokensOutput: usage.candidatesTokenCount || 0,
      totalTokens: (usage.promptTokenCount || 0) + (usage.candidatesTokenCount || 0),
      model: this.model
    };
  }

  async withRetry(fn, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await fn();
      } catch (e) {
        const isRetryable = e.status === 429 || (e.status >= 500 && e.status < 600);
        if (!isRetryable || i === maxRetries - 1) throw e;
        await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
      }
    }
  }
}
