import { describe, it, expect, vi, beforeEach } from 'vitest';

const datos: Record<string, Record<string, unknown>[]> = {};

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => name,
  query: (name: string) => name,
  getDocs: async (name: string) => ({
    docs: (datos[name] || []).map(d => ({ data: () => d })),
  }),
}));
vi.mock('../firebase', () => ({ db: {} }));

import { generateDatabaseXml } from '../utils/backup';

describe('la copia XML conserva los nombres y números reales de campo', () => {
  beforeEach(() => {
    for (const k of Object.keys(datos)) delete datos[k];
    datos.salarios = [{ 'Indicador de registro': 1, 'Sigla Compañía': 7 }];
    datos.transacciones = [{ Num: 3 }];
    datos.companias = [{ 'Indicador de registro': 7, 'Sigla Compañía': 'ABC' }];
  });

  it('conserva el número de compañía, el número de transacción y el indicador de registro', async () => {
    const xml = await generateDatabaseXml();
    expect(xml).toContain('<company_code>7</company_code>');
    expect(xml).toContain('<transaction_number>3</transaction_number>');
    const companias = xml.slice(xml.indexOf('<companies>'), xml.indexOf('</companies>'));
    expect(companias).toContain('<record_indicator>7</record_indicator>');
    expect(xml).not.toContain('Nro.');
  });
});
