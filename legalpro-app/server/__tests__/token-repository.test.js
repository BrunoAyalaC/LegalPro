import { describe, it, expect, vi } from 'vitest';
import { TokenRepository } from '../repositories/TokenRepository.js';

describe('TokenRepository — Pruebas unitarias de costos de tokens', () => {
  // Mock del objeto db (pool o cliente de postgres)
  const mockDb = {
    query: vi.fn().mockResolvedValue({ rows: [{ id: 1, total_tokens: 12000, costo_usd: 0.02250000 }], rowCount: 1 }),
  };

  it('calcularCosto para modelo Pro (debe usar tarifas de Pro)', () => {
    const repo = new TokenRepository(mockDb);
    // Modelo: MiniMax-M3- Pro
    // Prompt tokens: 10,000, Completion tokens: 2,000
    // Costo esperado: (10,000 * 1.25/M) + (2,000 * 5.00/M) = 0.0125 + 0.01 = 0.0225
    const costo = repo.calcularCosto('MiniMax-M3-Pro', 10000, 2000);
    expect(costo).toBe(0.02250000);
  });

  it('calcularCosto para modelo Lite (debe usar tarifas de Lite)', () => {
    const repo = new TokenRepository(mockDb);
    // Modelo: MiniMax-M2.5-highspeed (Lite)
    // Prompt tokens: 10,000, Completion tokens: 2,000
    // Costo esperado: (10,000 * 0.075/M) + (2,000 * 0.300/M) = 0.00075 + 0.0006 = 0.00135
    const costo = repo.calcularCosto('MiniMax-M2.5-highspeed', 10000, 2000);
    expect(costo).toBe(0.00135000);
  });

  it('calcularCosto por defecto usa tarifas de Lite si no coincide con Pro', () => {
    const repo = new TokenRepository(mockDb);
    // Modelo: MiniMax-M3 (no contiene "Pro", tarifa Lite)
    // Costo esperado: igual al de Lite = 0.00135
    const costo = repo.calcularCosto('MiniMax-M3', 10000, 2000);
    expect(costo).toBe(0.00135000);
  });

  it('registrarConsumo calcula el costo correcto e inserta en la base de datos', async () => {
    const localMockDb = {
      query: vi.fn().mockImplementation((sql, params) => {
        return Promise.resolve({ rows: [{ id: 99, ...params }], rowCount: 1 });
      }),
    };
    const repo = new TokenRepository(localMockDb);

    const res = await repo.registrarConsumo(
      'usr-1',
      'org-1',
      'chat',
      'MiniMax-M2.5-highspeed',
      10000,
      2000,
      'idemp-key-123'
    );

    expect(localMockDb.query).toHaveBeenCalledTimes(1);
    const [sql, params] = localMockDb.query.mock.calls[0];
    
    expect(sql).toContain('INSERT INTO consumo_tokens_ia');
    // params = [usuarioId, orgId, tipoOperacion, modelo, promptTokens, completionTokens, totalTokens, costoUsd, idempotencyKey]
    expect(params[0]).toBe('usr-1');
    expect(params[1]).toBe('org-1');
    expect(params[2]).toBe('chat');
    expect(params[3]).toBe('MiniMax-M2.5-highspeed');
    expect(params[4]).toBe(10000);
    expect(params[5]).toBe(2000);
    expect(params[6]).toBe(12000); // totalTokens
    expect(params[7]).toBe(0.00135000); // costoUsd calculado para Lite
    expect(params[8]).toBe('idemp-key-123');
  });

  it('obtenerConsumoDiarioOrg llama a la consulta correcta con organization_id', async () => {
    mockDb.query.mockClear();
    const repo = new TokenRepository(mockDb);
    await repo.obtenerConsumoDiarioOrg('org-1');
    expect(mockDb.query).toHaveBeenCalledTimes(1);
    const [sql, params] = mockDb.query.mock.calls[0];
    expect(sql).toContain('CURRENT_DATE');
    expect(params[0]).toBe('org-1');
  });

  it('contarConsultasMes llama COUNT(*) con DATE_TRUNC del mes actual', async () => {
    const localMockDb = {
      query: vi.fn().mockResolvedValue({ rows: [{ consultas_mes: 5 }] }),
    };
    const repo = new TokenRepository(localMockDb);
    const result = await repo.contarConsultasMes('org-1');
    expect(localMockDb.query).toHaveBeenCalledTimes(1);
    const [sql, params] = localMockDb.query.mock.calls[0];
    expect(sql).toContain('COUNT(*)');
    expect(sql).toContain('DATE_TRUNC');
    expect(sql).toContain('organization_id = $1');
    expect(params[0]).toBe('org-1');
    expect(result.consultas_mes).toBe(5);
  });

  it('contarConsultasMes retorna 0 cuando no hay consultas en el mes', async () => {
    const localMockDb = {
      query: vi.fn().mockResolvedValue({ rows: [{ consultas_mes: 0 }] }),
    };
    const repo = new TokenRepository(localMockDb);
    const result = await repo.contarConsultasMes('org-2');
    expect(result.consultas_mes).toBe(0);
  });
});
