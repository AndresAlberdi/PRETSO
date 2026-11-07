import { describe, it, expect, vi } from 'vitest';

vi.mock('../../firebase', () => ({ db: {} }));

import { MAPA_SECCIONES } from '../../utils/busquedaGuia/mapaSecciones';
import { COLUMN_ORDERS } from '../../utils/xlsxExport';
import { esCampoRetirado } from '../../utils/camposRetirados';

describe('MAPA_SECCIONES', () => {
  it('declara las ocho colecciones', () => {
    expect(MAPA_SECCIONES.map(s => s.coleccion).sort()).toEqual(Object.keys(COLUMN_ORDERS).sort());
  });
  it('todos los campos están en COLUMN_ORDERS de su colección', () => {
    for (const s of MAPA_SECCIONES) {
      for (const c of s.campos) expect(COLUMN_ORDERS[s.coleccion]).toContain(c.campo);
    }
  });
  it('ningún campo está retirado', () => {
    for (const s of MAPA_SECCIONES) {
      for (const c of s.campos) expect(esCampoRetirado(s.coleccion, c.campo)).toBe(false);
    }
  });
  it('no indexa el número de registro ni «Transacción»', () => {
    for (const s of MAPA_SECCIONES) {
      const nombres = s.campos.map(c => c.campo);
      expect(nombres).not.toContain('Indicador de registro');
      expect(nombres).not.toContain('Transacción');
    }
  });
  it('usa nombres visibles con minúscula en español', () => {
    const nombres = MAPA_SECCIONES.map(s => s.nombre);
    expect(nombres).toContain('Manejo de caja');
    expect(nombres).toContain('Índice de compañías');
    expect(nombres).toContain('Identificación de indicadores');
    expect(nombres).toContain('Corpus Christi');
  });
  it('solo Transacciones y Documentos son de administrador', () => {
    expect(MAPA_SECCIONES.filter(s => s.soloAdmin).map(s => s.coleccion).sort()).toEqual(['documentos', 'transacciones']);
  });
  it('marca los campos de año', () => {
    const anios = MAPA_SECCIONES.flatMap(s => s.campos.filter(c => c.anio).map(c => `${s.coleccion}.${c.campo}`)).sort();
    expect(anios).toEqual([
      'companias.Temporadas teatrales', 'corpus_christi.Año', 'indicadores.Años', 'manejo_de_caja.Año', 'salarios.Año',
    ]);
  });
});
