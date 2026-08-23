/**
 * OpenCode Client Tests - DeepSeek V4 Flash vía OpenCode Go
 *
 * Valida la migración OPENCODE-FIRST:
 *  - isConfigured() según OPENCODE_API_KEY
 *  - generateText() con formato OpenAI-compatible
 *  - chatStream() procesando eventos SSE
 *  - embeddings() para RAG
 *
 * SKILL: vitest-test-writer
 * @author BackendNode
 */
import { describe, test, expect, vi, beforeEach } from 'vitest';

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('opencodeClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete process.env.OPENCODE_API_KEY;
    delete process.env.OPENCODE_BASE_URL;
    delete process.env.OPENCODE_MODEL;
  });

  describe('isConfigured()', () => {
    test('Devuelve false sin OPENCODE_API_KEY', async () => {
      const { opencodeClient } = await import('../utils/opencodeClient.js');
      expect(opencodeClient.isConfigured()).toBe(false);
    });

    test('Devuelve true con OPENCODE_API_KEY', async () => {
      process.env.OPENCODE_API_KEY = 'sk-test-123';
      const { opencodeClient } = await import('../utils/opencodeClient.js');
      expect(opencodeClient.isConfigured()).toBe(true);
    });
  });

  describe('generateText()', () => {
    test('Devuelve contenido de respuesta', async () => {
      process.env.OPENCODE_API_KEY = 'sk-test-123';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Respuesta de DeepSeek' } }]
        })
      });

      const { opencodeClient } = await import('../utils/opencodeClient.js');
      const result = await opencodeClient.generateText('¿Qué es la prescripción?');
      expect(result).toBe('Respuesta de DeepSeek');
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/chat/completions');
      expect(JSON.parse(options.body).model).toBe('deepseek-v4-flash-free');
    });

    test('Lanza error cuando API falla', async () => {
      process.env.OPENCODE_API_KEY = 'sk-test-123';
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: async () => 'Internal Server Error'
      });

      const { opencodeClient } = await import('../utils/opencodeClient.js');
      await expect(opencodeClient.generateText('test')).rejects.toThrow(/OpenCode API error/);
    });
  });

  describe('chatStream()', () => {
    test('Procesa eventos SSE correctamente', async () => {
      process.env.OPENCODE_API_KEY = 'sk-test-123';

      // Simular SSE stream
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hola"}}]}\n\n'));
          controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":" mundo"}}]}\n\n'));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: { getReader: () => stream.getReader() }
      });

      const { opencodeClient } = await import('../utils/opencodeClient.js');
      const chunks = [];
      await opencodeClient.chatStream({ messages: [{ role: 'user', content: 'hola' }], onChunk: (c) => chunks.push(c) });
      expect(chunks.join('')).toBe('Hola mundo');
    });
  });

  describe('embeddings()', () => {
    test('Devuelve embedding para RAG', async () => {
      process.env.OPENCODE_API_KEY = 'sk-test-123';
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: [{ embedding: [0.1, 0.2, 0.3] }] })
      });

      const { opencodeClient } = await import('../utils/opencodeClient.js');
      const embedding = await opencodeClient.embeddings('test');
      expect(embedding).toEqual([0.1, 0.2, 0.3]);
    });
  });
});
