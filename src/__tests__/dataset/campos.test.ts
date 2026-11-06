import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => name,
  query: (name: string) => name,
  getDocs: async () => ({ docs: [] }),
}));
vi.mock('../../firebase', () => ({ db: {} }));

import { translateField } from '../../utils/backup';
import { CAMPOS_RETIRADOS } from '../../utils/camposRetirados';
import { CAMPOS_DATASET, type ColeccionDataset } from '../../utils/dataset/campos';

const colecciones = Object.keys(CAMPOS_DATASET) as ColeccionDataset[];

describe('CAMPOS_DATASET', () => {
  it('coincide con los nombres de la copia completa (salvo company_name)', () => {
    for (const col of colecciones) {
      for (const def of CAMPOS_DATASET[col]) {
        if (def.elemento === 'company_name') continue;
        expect(translateField(col, def.campo), `${col}.${def.campo}`).toBe(def.elemento);
      }
    }
  });

  it('no incluye campos retirados', () => {
    for (const col of colecciones) {
      const nombres = CAMPOS_DATASET[col].map((d) => d.campo);
      for (const retirado of CAMPOS_RETIRADOS[col] ?? []) expect(nombres).not.toContain(retirado);
    }
  });

  it('no incluye identificadores internos ni campos heredados', () => {
    for (const col of colecciones) {
      const nombres = CAMPOS_DATASET[col].map((d) => d.campo);
      expect(nombres).not.toContain('Indicador de registro');
      expect(nombres).not.toContain('Transacción');
      expect(nombres).not.toContain('Moneda');
      if (col !== 'companias') expect(nombres).not.toContain('Sigla Compañía');
    }
  });

  it('conserva el espacio final de Beneficiario y Encargado, y usa NFC', () => {
    expect(CAMPOS_DATASET.salarios.map((d) => d.campo)).toContain('Beneficiario ');
    expect(CAMPOS_DATASET.corpus_christi.map((d) => d.campo)).toContain('Encargado ');
    for (const col of colecciones) {
      for (const d of CAMPOS_DATASET[col]) {
        expect(d.campo).toBe(d.campo.normalize('NFC'));
        expect(d.etiqueta).toBe(d.etiqueta.normalize('NFC'));
      }
    }
  });
});
