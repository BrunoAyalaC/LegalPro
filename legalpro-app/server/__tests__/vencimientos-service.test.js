// legalpro-app/server/__tests__/vencimientos-service.test.js
// Tests unitarios de vencimientosService (lógica pura, sin BD real).
// Cubre: cálculo de vencimientos, clasificación de urgencia, filtro de ventana,
// exclusión de no activos, SIN_FECHA_DEFINIDA y conteo de días hábiles.
import { describe, it, expect } from 'vitest';
import {
  calcularVencimientos,
  clasificarUrgencia,
  contarDiasHabilesEntre,
} from '../services/vencimientosService.js';

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

const baseExpediente = {
  id: '11111111-1111-1111-1111-111111111111',
  numero: '00123-2026-0-1801-JP-CI-01',
  titulo: 'Demanda de desalojo',
  tipo: 'civil',
  materia: 'civil',
  estado: 'activo',
  es_urgente: false,
  created_at: daysAgo(20),
  deleted_at: null,
};

describe('clasificarUrgencia', () => {
  it('mapea días hábiles restantes a niveles de urgencia', () => {
    expect(clasificarUrgencia(0)).toBe('CRITICA');
    expect(clasificarUrgencia(1)).toBe('CRITICA');
    expect(clasificarUrgencia(5)).toBe('ALTA');
    expect(clasificarUrgencia(6)).toBe('MEDIA');
    expect(clasificarUrgencia(15)).toBe('MEDIA');
    expect(clasificarUrgencia(16)).toBe('BAJA');
    expect(clasificarUrgencia(null)).toBe('BAJA');
  });
});

describe('contarDiasHabilesEntre', () => {
  it('cuenta días hábiles entre dos fechas (excluye fines de semana)', () => {
    // 2026-08-10 es lunes, 2026-08-14 es viernes → 5 hábiles
    expect(contarDiasHabilesEntre('2026-08-10', '2026-08-14')).toBe(5);
    // 2026-08-08 sábado → 0 hábiles entre sábado y sábado
    expect(contarDiasHabilesEntre('2026-08-08', '2026-08-08')).toBe(0);
    // fecha fin anterior a inicio → 0
    expect(contarDiasHabilesEntre('2026-08-14', '2026-08-10')).toBe(0);
  });
});

describe('calcularVencimientos', () => {
  it('genera PLAZO_CONTESTACION estimado para materia civil', () => {
    const venc = calcularVencimientos([baseExpediente], { dias: 30 });
    const civil = venc.find((v) => v.expediente_id === baseExpediente.id);
    expect(civil).toBeDefined();
    expect(civil.evento).toBe('PLAZO_CONTESTACION');
    expect(civil.urgencia).toBe('BAJA'); // ~19-20 días hábiles restantes
    expect(civil.estimado).toBe(true);
    expect(civil.base_legal).toContain('CPC');
    expect(civil.fecha_limite).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('mapea la materia Obligaciones al catálogo civil', () => {
    const obligaciones = {
      ...baseExpediente,
      materia: 'Obligaciones',
    };
    const venc = calcularVencimientos([obligaciones], { dias: 30 });
    expect(venc).toHaveLength(1);
    expect(venc[0].evento).toBe('PLAZO_CONTESTACION');
    expect(venc[0].base_legal).toContain('CPC');
  });

  it('normaliza Obligaciones sin depender de mayúsculas', () => {
    const obligaciones = {
      ...baseExpediente,
      materia: 'OBLIGACIONES',
    };
    const venc = calcularVencimientos([obligaciones], { dias: 30 });
    expect(venc[0].evento).toBe('PLAZO_CONTESTACION');
  });

  it('filtra expedientes fuera de la ventana ?dias', () => {
    const venc = calcularVencimientos([baseExpediente], { dias: 5 });
    expect(venc.filter((v) => v.expediente_id === baseExpediente.id).length).toBe(0);
  });

  it('excluye expedientes archivados/cerrados', () => {
    const archivado = { ...baseExpediente, estado: 'archivado' };
    const venc = calcularVencimientos([archivado], { dias: 30 });
    expect(venc.length).toBe(0);
  });

  it('marca SIN_FECHA_DEFINIDA para activos sin fecha ni plazo aplicable', () => {
    const sinFecha = { ...baseExpediente, created_at: null, materia: null };
    const venc = calcularVencimientos([sinFecha], { dias: 30 });
    expect(venc.length).toBe(1);
    expect(venc[0].evento).toBe('SIN_FECHA_DEFINIDA');
    expect(venc[0].fecha_limite).toBeNull();
    expect(venc[0].urgencia).toBe('BAJA');
  });

  it('genera CADUCIDAD para materia constitucional con plazo de caducidad', () => {
    // Catálogo v1.4.0: la caducidad de amparo es de 30 días bajo la Ley 31307
    // (NCPCConst 2021) art. 45, VIGENTE desde 2022. La Ley 28237 (60 días)
    // está DEROGADA y solo sobrevive como nota_transicion en el catálogo.
    // created_at a 20 días → vencimiento en ~10 días (dentro de la ventana).
    const amparo = {
      ...baseExpediente,
      id: '33333333-3333-3333-3333-333333333333',
      numero: '00450-2026-0-1801-JR-CO-01',
      titulo: 'Amparo contra SUNAT',
      tipo: 'constitucional',
      materia: 'constitucional',
      created_at: daysAgo(20),
    };
    const venc = calcularVencimientos([amparo], { dias: 30 });
    const cad = venc.find((v) => v.evento === 'CADUCIDAD');
    expect(cad).toBeDefined();
    expect(cad.base_legal).toContain('31307');
  });

  it('ordena resultados por fecha_limite asc y SIN_FECHA_DEFINIDA al final', () => {
    const conCaducidad = {
      ...baseExpediente,
      id: '33333333-3333-3333-3333-333333333333',
      numero: '00450-2026-0-1801-JR-CO-01',
      titulo: 'Amparo',
      tipo: 'constitucional',
      materia: 'constitucional',
      // Caducidad Ley 31307 = 30 días → vence en ~10 días (genera evento).
      created_at: daysAgo(20),
    };
    const sinFecha = {
      ...baseExpediente,
      id: '44444444-4444-4444-4444-444444444444',
      numero: '00011-2026-0-1801-JP-CI-02',
      titulo: 'Sin fecha',
      created_at: null,
      materia: null,
    };
    const venc = calcularVencimientos([baseExpediente, conCaducidad, sinFecha], { dias: 30 });
    const fechas = venc.filter((v) => v.fecha_limite).map((v) => v.fecha_limite);
    const fechasOrdenadas = [...fechas].sort();
    expect(fechas).toEqual(fechasOrdenadas);
    // SIN_FECHA_DEFINIDA siempre queda al final
    expect(venc[venc.length - 1].evento).toBe('SIN_FECHA_DEFINIDA');
    expect(venc[venc.length - 1].fecha_limite).toBeNull();
  });
});
