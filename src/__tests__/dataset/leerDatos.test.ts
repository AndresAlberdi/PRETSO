import { describe, it, expect, vi, beforeEach } from 'vitest';

const datos: Record<string, Record<string, unknown>[]> = {};
const consultadas: string[] = [];

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => name,
  query: (name: string) => name,
  getDocs: async (name: string) => {
    consultadas.push(name);
    return { docs: (datos[name] || []).map((d, i) => ({ id: `id${i}`, data: () => d })) };
  },
}));
vi.mock('../../firebase', () => ({ db: {} }));

import { COLECCIONES_DATASET, leerDatosDataset } from '../../utils/dataset/leerDatos';

describe('leerDatosDataset', () => {
  beforeEach(() => {
    consultadas.length = 0;
    for (const k of Object.keys(datos)) delete datos[k];
    datos.companias = [{ 'Sigla Compañía': 'ABC', Ámbito: 'x' }];
    datos.transacciones = [{ Num: 3 }];
  });

  it('consulta exactamente las 7 colecciones y nunca logs, users ni indicadores', async () => {
    const r = await leerDatosDataset();
    expect([...consultadas].sort()).toEqual([...COLECCIONES_DATASET].sort());
    expect(COLECCIONES_DATASET).toHaveLength(7);
    for (const prohibida of ['logs', 'users', 'indicadores']) expect(consultadas).not.toContain(prohibida);
    expect(Object.keys(r).sort()).toEqual([...COLECCIONES_DATASET].sort());
    expect(r.transacciones).toEqual([{ id: 'id0', Num: 3 }]);
    expect(r.bibliografia).toEqual([]);
  });

  it("convierte 'x' en vacío", async () => {
    const r = await leerDatosDataset();
    expect(r.companias[0]['Ámbito']).toBe('');
    expect(r.companias[0]['Sigla Compañía']).toBe('ABC');
  });
});
