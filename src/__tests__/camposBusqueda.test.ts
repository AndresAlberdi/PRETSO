import { describe, it, expect } from 'vitest';
import { COLUMN_ORDERS } from '../utils/xlsxExport';
import {
  CAMPOS_BUSQUEDA_DOCUMENTOS,
  CAMPOS_BUSQUEDA_TRANSACCIONES,
} from '../utils/camposBusqueda';

const camposDe = (mapa: Record<string, { campos: string[] }>) =>
  Object.values(mapa).flatMap(c => c.campos);

describe('nombres de campo de los buscadores', () => {
  it('Documentos usa solo columnas reales de la colección', () => {
    for (const campo of camposDe(CAMPOS_BUSQUEDA_DOCUMENTOS)) {
      expect(COLUMN_ORDERS.documentos).toContain(campo);
    }
  });
  it('Transacciones usa solo columnas reales de la colección', () => {
    for (const campo of camposDe(CAMPOS_BUSQUEDA_TRANSACCIONES)) {
      expect(COLUMN_ORDERS.transacciones).toContain(campo);
    }
  });
  it('incluye Doc1…Doc10, Num, Noticia y Fuentes con su tilde', () => {
    const c = CAMPOS_BUSQUEDA_TRANSACCIONES;
    expect(c.doc.campos).toEqual(Array.from({ length: 10 }, (_, i) => `Doc${i + 1}`));
    expect(c.num.campos).toEqual(['Num']);
    expect(c.noticia.campos).toEqual(['Noticia']);
    expect(c.fuentes.campos).toEqual(['Fuentes para la generación del dato']);
  });
  it('los identificadores usan modo exacto y el texto libre «contiene»', () => {
    expect(CAMPOS_BUSQUEDA_DOCUMENTOS.doc.modo).toBe('exacto');
    expect(CAMPOS_BUSQUEDA_TRANSACCIONES.num.modo).toBe('exacto');
    expect(CAMPOS_BUSQUEDA_TRANSACCIONES.doc.modo).toBe('exacto');
    expect(CAMPOS_BUSQUEDA_DOCUMENTOS.all.modo ?? 'contiene').toBe('contiene');
    expect(CAMPOS_BUSQUEDA_TRANSACCIONES.all.modo ?? 'contiene').toBe('contiene');
  });
});
