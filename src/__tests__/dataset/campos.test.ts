import { describe, it, expect, vi } from 'vitest';

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => name,
  query: (name: string) => name,
  getDocs: async () => ({ docs: [] }),
}));
vi.mock('../../firebase', () => ({ db: {} }));

import { translateField } from '../../utils/backup';
import { CAMPOS_RETIRADOS } from '../../utils/camposRetirados';
import { CAMPOS_DATASET, CAMPOS_ENCABEZADO_CORPUS, type ColeccionDataset } from '../../utils/dataset/campos';

const colecciones = Object.keys(CAMPOS_DATASET) as ColeccionDataset[];

const ESPERADOS: Record<ColeccionDataset, Array<[string, string]>> = {
  companias: [
    ['Sigla Compañía', 'company_code'],
    ['Nombre Compañía', 'company_name'],
    ['Autores', 'authors'],
    ['Temporadas teatrales', 'theatrical_seasons'],
    ['Índice de compañías', 'company_index'],
    ['Ámbito', 'scope'],
  ],
  transacciones: [
    ['Num', 'transaction_number'],
    ['Noticia', 'transaction_news'],
    ['Fuentes para la generación del dato', 'sources'],
  ],
  documentos: [
    ['Doc', 'doc_id'],
    ['Documento', 'document_text'],
  ],
  manejo_de_caja: [
    ['Año', 'year'],
    ['Ciudad', 'city'],
    ['Ingresos', 'income'],
    ['Egresos', 'expenses'],
    ['Otros bienes de la compañía', 'other_company_assets'],
  ],
  salarios: [
    ['Año', 'year'],
    ['Ciudad', 'city'],
    ['Beneficiario ', 'beneficiary'],
    ['Encargo', 'role'],
    ['Monto a pagar', 'amount_paid'],
    ['Ración diaria', 'daily_allowance'],
    ['Pago por representación', 'performance_pay'],
  ],
  corpus_christi: [
    ['Encargo', 'task'],
    ['Encargado ', 'person_in_charge'],
    ['Monto a pagar', 'amount_paid'],
    ['Fondos', 'funds'],
  ],
  bibliografia: [
    ['Autores', 'authors'],
    ['Referencias bibliográficas', 'bibliographical_references'],
  ],
};

describe('CAMPOS_DATASET', () => {
  it('tiene exactamente los pares campo/elemento esperados, en orden', () => {
    for (const col of colecciones) {
      expect(CAMPOS_DATASET[col].map((d) => [d.campo, d.elemento]), col).toEqual(ESPERADOS[col]);
    }
  });

  it('el encabezado de Corpus coincide con la copia completa', () => {
    for (const def of CAMPOS_ENCABEZADO_CORPUS) {
      expect(translateField('corpus_christi', def.campo)).toBe(def.elemento);
    }
  });

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
