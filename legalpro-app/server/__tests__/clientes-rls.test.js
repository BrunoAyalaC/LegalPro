/**
 * RLS POLICY TESTS — Tabla `clientes`
 * Valida con regex que el schema SQL en init.sql declara correctamente:
 *  - ENABLE ROW LEVEL SECURITY
 *  - Policy "FOR ALL" que usa fn_rls_current_org_id()
 *  - Trigger de updated_at (no es RLS pero está asociado)
 *  - Índices de soporte
 *
 * NO se ejecuta contra una BD real — sólo lectura del archivo + regex.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SQL_PATH = resolve(__dirname, '../init.sql');

let sql;
beforeAll(() => {
  sql = readFileSync(SQL_PATH, 'utf8');
});

// ═══════════════════════════════════════════════════════════════════════
// Localiza el bloque de RLS de clientes en el SQL completo
// ═══════════════════════════════════════════════════════════════════════
function extractClientesRLSBlock(source) {
  // Busca desde "RLS: clientes" hasta la próxima policy/comentario de otra tabla
  const startMatch = source.match(/-- RLS: clientes[\s\S]*?ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;/);
  if (!startMatch) throw new Error('No se encontró el inicio del bloque RLS de clientes');
  const startIdx = startMatch.index;
  // Corta hasta el próximo "-- ---" separador de sección o fin de archivo
  const rest = source.slice(startIdx);
  const endMatch = rest.match(/\n-- -+\n(?=-- [A-Z])/);
  const block = endMatch ? rest.slice(0, endMatch.index) : rest;
  return block;
}

describe('init.sql — tabla clientes RLS', () => {
  let block;

  beforeAll(() => {
    block = extractClientesRLSBlock(sql);
  });

  it('ALTER TABLE clientes ENABLE ROW LEVEL SECURITY está presente', () => {
    expect(block).toMatch(/ALTER TABLE clientes\s+ENABLE ROW LEVEL SECURITY\s*;/i);
  });

  it('declara una policy p_clientes_all FOR ALL', () => {
    expect(block).toMatch(/CREATE POLICY\s+p_clientes_all\s+ON clientes\s+FOR ALL\s+/i);
  });

  it('la policy USING hace referencia a fn_rls_current_org_id()', () => {
    expect(block).toMatch(/USING\s*\(\s*organization_id\s*=\s*fn_rls_current_org_id\(\)\s*\)/i);
  });

  it('la policy WITH CHECK hace referencia a fn_rls_current_org_id()', () => {
    expect(block).toMatch(/WITH CHECK\s*\(\s*organization_id\s*=\s*fn_rls_current_org_id\(\)\s*\)/i);
  });

  it('la policy cubre SELECT (implícito en FOR ALL)', () => {
    expect(block).toMatch(/FOR ALL/i);
  });

  it('NO usa auth.uid() (no hay Supabase Auth)', () => {
    // Defensa contra regresión: si alguien copia de Supabase, esto falla
    expect(block).not.toMatch(/auth\.uid\(\)/i);
  });

  it('NO usa USING (true) — la policy debe filtrar siempre', () => {
    expect(block).not.toMatch(/USING\s*\(\s*TRUE\s*\)/i);
  });

  it('NO usa WITH CHECK TRUE — la policy debe validar siempre', () => {
    expect(block).not.toMatch(/WITH CHECK\s+TRUE/i);
  });

  it('incluye COMMENT ON POLICY documentando el aislamiento', () => {
    expect(block).toMatch(/COMMENT ON POLICY p_clientes_all ON clientes/i);
  });

  it('usa DROP POLICY IF EXISTS para idempotencia', () => {
    expect(block).toMatch(/DROP POLICY IF EXISTS p_clientes_all ON clientes\s*;/i);
  });

  it('la policy no permite bypass de org (no hay OR con TRUE)', () => {
    // Patrón peligroso: USING (org = ... OR TRUE)
    expect(block).not.toMatch(/USING\s*\([^)]*OR\s+TRUE\s*\)/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Funciones RLS de soporte
// ═══════════════════════════════════════════════════════════════════════
describe('init.sql — funciones RLS de soporte', () => {
  it('existe fn_rls_current_org_id() que lee app.current_org_id', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION\s+fn_rls_current_org_id\s*\(/i);
    expect(sql).toMatch(/current_setting\s*\(\s*'app\.current_org_id'/i);
    expect(sql).toMatch(/RETURNS UUID/i);
  });

  it('existe fn_rls_current_user_id() que lee app.current_user_id', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION\s+fn_rls_current_user_id\s*\(/i);
    expect(sql).toMatch(/current_setting\s*\(\s*'app\.current_user_id'/i);
  });

  it('existe fn_rls_current_user_rol() que lee app.current_user_rol', () => {
    expect(sql).toMatch(/CREATE OR REPLACE FUNCTION\s+fn_rls_current_user_rol\s*\(/i);
    expect(sql).toMatch(/current_setting\s*\(\s*'app\.current_user_rol'/i);
  });

  it('las 3 funciones son STABLE (rendimiento)', () => {
    const fnRegex = /CREATE OR REPLACE FUNCTION\s+fn_rls_current_(?:user_id|org_id|user_rol)\s*\([\s\S]*?LANGUAGE plpgsql\s+(STABLE|IMMUTABLE|VOLATILE)/gi;
    const matches = sql.match(fnRegex) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
    for (const m of matches) {
      expect(m).toMatch(/\bSTABLE\b/i);
    }
  });

  it('las funciones manejan excepciones y devuelven NULL si no hay setting', () => {
    expect(sql).toMatch(/EXCEPTION WHEN OTHERS THEN\s+RETURN NULL/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Definición de tabla clientes
// ═══════════════════════════════════════════════════════════════════════
describe('init.sql — definición tabla clientes', () => {
  let clientesTableBlock;

  beforeAll(() => {
    // Aislar el bloque CREATE TABLE clientes ... ;
    const m = sql.match(/CREATE TABLE IF NOT EXISTS clientes \([\s\S]*?\n\);/);
    if (!m) throw new Error('No se encontró CREATE TABLE clientes');
    clientesTableBlock = m[0];
  });

  it('tiene organization_id NOT NULL con FK a organizaciones', () => {
    expect(clientesTableBlock).toMatch(/organization_id\s+UUID\s+NOT NULL\s+REFERENCES organizaciones\(id\)\s+ON DELETE CASCADE/i);
  });

  it('tiene tipo_persona con CHECK natural|juridica', () => {
    expect(clientesTableBlock).toMatch(/tipo_persona\s+TEXT\s+NOT NULL\s+DEFAULT 'natural'/i);
    expect(clientesTableBlock).toMatch(/CHECK\s*\(\s*tipo_persona\s+IN\s*\(\s*'natural',\s*'juridica'\s*\)\s*\)/i);
  });

  it('DNI es CHAR(8) UNIQUE', () => {
    expect(clientesTableBlock).toMatch(/dni\s+CHAR\(8\)\s+UNIQUE/i);
  });

  it('RUC es CHAR(11) UNIQUE', () => {
    expect(clientesTableBlock).toMatch(/ruc\s+CHAR\(11\)\s+UNIQUE/i);
  });

  it('tiene columna eliminado_en para soft-delete', () => {
    expect(clientesTableBlock).toMatch(/eliminado_en\s+TIMESTAMPTZ/i);
  });

  it('tiene trigger trg_clientes_updated_at', () => {
    expect(sql).toMatch(/DROP TRIGGER IF EXISTS trg_clientes_updated_at ON clientes\s*;/i);
    expect(sql).toMatch(/CREATE TRIGGER trg_clientes_updated_at[\s\S]*?BEFORE UPDATE ON clientes[\s\S]*?EXECUTE FUNCTION fn_set_updated_at\(\)/i);
  });

  it('tiene índices por organization_id, dni, ruc', () => {
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_clientes_org\s+ON clientes\(organization_id\)/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_clientes_dni\s+ON clientes\(dni\)/i);
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_clientes_ruc\s+ON clientes\(ruc\)/i);
  });

  it('tiene índice GIN para búsqueda full-text en nombre/razon_social', () => {
    expect(sql).toMatch(/CREATE INDEX IF NOT EXISTS idx_clientes_nombre[\s\S]*?USING gin\(to_tsvector/i);
  });

  it('COMMENT ON TABLE documenta aislamiento multi-tenant', () => {
    expect(sql).toMatch(/COMMENT ON TABLE clientes IS/i);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Consistencia: TODAS las tablas con datos de tenant deben estar cubiertas
// ═══════════════════════════════════════════════════════════════════════
describe('init.sql — cobertura RLS de tablas tenant', () => {
  it('enable RLS está en: usuarios, expedientes, documentos, clientes', () => {
    expect(sql).toMatch(/ALTER TABLE usuarios\s+ENABLE ROW LEVEL SECURITY\s*;/i);
    expect(sql).toMatch(/ALTER TABLE expedientes\s+ENABLE ROW LEVEL SECURITY\s*;/i);
    expect(sql).toMatch(/ALTER TABLE documentos\s+ENABLE ROW LEVEL SECURITY\s*;/i);
    expect(sql).toMatch(/ALTER TABLE clientes\s+ENABLE ROW LEVEL SECURITY\s*;/i);
  });

  it('cada policy multi-tenant referencia fn_rls_current_org_id()', () => {
    // Cuenta policies que usan fn_rls_current_org_id (debe ser >= 4)
    const matches = sql.match(/organization_id\s*=\s*fn_rls_current_org_id\(\)/gi) || [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });
});