import { describe, it, expect, vi, beforeEach } from 'vitest';

const commits: Array<() => Promise<void>> = [];
const lotes: Array<{ updates: unknown[]; sets: unknown[][]; commit: ReturnType<typeof vi.fn> }> = [];
let falloEnLote = -1;
let ids: string[] = [];
const where = vi.fn((...a: unknown[]) => ({ where: a }));

vi.mock('../firebase', () => ({ db: {}, auth: { currentUser: { email: 'admin@example.com' } } }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, n: string) => n,
  query: (n: string) => n,
  where: (...a: unknown[]) => where(...a),
  doc: (_db: unknown, c: string, id?: string) => (id === undefined ? `${c}/nuevo` : `${c}/${id}`),
  serverTimestamp: () => 'TS',
  getDocs: async () => ({ docs: ids.map(id => ({ id })) }),
  writeBatch: () => {
    const indice = lotes.length;
    const lote = {
      updates: [] as unknown[],
      update: (...a: unknown[]) => { lote.updates.push(a); },
      sets: [] as unknown[][],
      set: (...a: unknown[]) => { lote.sets.push(a); },
      commit: vi.fn(async () => { if (indice === falloEnLote) throw new Error('fallo'); }),
    };
    lotes.push(lote);
    return lote;
  },
}));

import {
  validarNuevoNombreCategoria, renombrarCategoria, RenombreParcialError, MAX_LONGITUD_CATEGORIA,
} from '../utils/renombrarCategoria';

beforeEach(() => {
  commits.length = 0; lotes.length = 0; falloEnLote = -1; ids = [];
  where.mockClear();
});

describe('validarNuevoNombreCategoria', () => {
  const existentes = ['Pan', 'Vino'];
  it('rechaza vacío, sin cambio, largo y duplicado', () => {
    expect(validarNuevoNombreCategoria('  ', 'Pan', existentes)).toBe('vacio');
    expect(validarNuevoNombreCategoria('Pan', 'Pan', existentes)).toBe('sin_cambio');
    expect(validarNuevoNombreCategoria('x'.repeat(MAX_LONGITUD_CATEGORIA + 1), 'Pan', existentes)).toBe('largo');
    expect(validarNuevoNombreCategoria('víno', 'Pan', existentes)).toBe('duplicado');
  });
  it('acepta un nombre nuevo y el cambio solo de mayúsculas de la misma categoría', () => {
    expect(validarNuevoNombreCategoria('Carne', 'Pan', existentes)).toBeNull();
    expect(validarNuevoNombreCategoria('PAN', 'Pan', existentes)).toBeNull();
  });
  it('bloquea «PAN» si otra categoría distinta, «PAN», ya existe aparte de «Pan»', () => {
    expect(validarNuevoNombreCategoria('PAN', 'Pan', ['Pan', 'PAN'])).toBe('duplicado');
  });
});

describe('renombrarCategoria', () => {
  it('consulta por la categoría anterior y con 401 documentos hace 3 commits de 200, 200 y 1', async () => {
    ids = Array.from({ length: 401 }, (_, i) => `d${i}`);
    const n = await renombrarCategoria('Pan', ' Panes ');
    expect(n).toBe(401);
    expect(where).toHaveBeenCalledWith('Categorías', '==', 'Pan');
    expect(lotes.map(l => l.updates.length)).toEqual([200, 200, 1]);
    expect(lotes.map(l => l.sets.length)).toEqual([200, 200, 1]);
    lotes.forEach(l => expect(l.commit).toHaveBeenCalledTimes(1));
    expect(lotes[0].updates[0]).toEqual(['indicadores/d0', { 'Categorías': 'Panes' }]);
  });
  it('escribe la bitácora en el mismo lote, con la forma que exigen las reglas', async () => {
    ids = ['a', 'b'];
    await renombrarCategoria('Pan', 'Panes');
    expect(lotes).toHaveLength(1);
    expect(lotes[0].sets).toHaveLength(2);
    expect(lotes[0].sets[1][1]).toEqual({
      action: 'EDIT', collection: 'indicadores', recordId: 'b', user: 'admin@example.com',
      timestamp: 'TS', details: { 'Categorías': 'Panes', categoriaAnterior: 'Pan' },
    });
  });
  it('si falla el segundo lote informa RENOMBRE_PARCIAL con los ids actualizados', async () => {
    ids = Array.from({ length: 401 }, (_, i) => `d${i}`);
    falloEnLote = 1;
    const error = await renombrarCategoria('Pan', 'Panes').catch(e => e);
    expect(error).toBeInstanceOf(RenombreParcialError);
    expect(error.code).toBe('RENOMBRE_PARCIAL');
    expect(error.actualizados).toHaveLength(200);
    expect(error.actualizados[0]).toBe('d0');
    expect(lotes).toHaveLength(2);
  });
  it('sin documentos no hace commits', async () => {
    expect(await renombrarCategoria('Pan', 'Panes')).toBe(0);
    expect(lotes).toHaveLength(0);
  });
});
