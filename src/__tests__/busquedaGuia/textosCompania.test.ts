import { describe, it, expect } from 'vitest';
import { textosCompaniaBuscables } from '../../utils/busquedaGuia/textosCompania';

const companias = [
  { 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', 'Nombre Compañía': 'Compañía de Alarcón' },
  { 'Indicador de registro': 12, 'Sigla Compañía': '', 'Nombre Compañía': 'Compañía de Vargas' },
  { 'Indicador de registro': 13 },
];

describe('textosCompaniaBuscables', () => {
  it('caja: devuelve la sigla de la compañía referenciada por número', () => {
    expect(textosCompaniaBuscables({ 'Sigla Compañía': 7, Ciudad: 'Potosí' }, 'manejo_de_caja', companias)).toEqual(['GA-JR']);
  });

  it('corpus: sigla y nombre cuando no hay sigla; omite campos que no son compañía', () => {
    expect(textosCompaniaBuscables({ 'Compañía': 7, 'Compañía2': 12, 'Encargado ': 'Ana' }, 'corpus_christi', companias))
      .toEqual(['GA-JR', 'Compañía de Vargas']);
  });

  it('no incluye el rótulo de compañía no encontrada ni valores vacíos', () => {
    expect(textosCompaniaBuscables({ 'Sigla Compañía': 99 }, 'salarios', companias)).toEqual([]);
    expect(textosCompaniaBuscables({ 'Sigla Compañía': '' }, 'indicadores', companias)).toEqual([]);
    expect(textosCompaniaBuscables({ 'Sigla Compañía': 13 }, 'indicadores', companias)).toEqual([]);
  });

  it('con caché da el mismo resultado y reutiliza la resolución', () => {
    const cache = new Map<string, string>();
    const r = { 'Sigla Compañía': '7.0' };
    expect(textosCompaniaBuscables(r, 'salarios', companias, cache)).toEqual(['GA-JR']);
    expect(textosCompaniaBuscables(r, 'salarios', companias, cache)).toEqual(['GA-JR']);
    expect(cache.size).toBe(1);
  });

  it('colecciones sin referencias devuelven vacío', () => {
    expect(textosCompaniaBuscables({ 'Sigla Compañía': 'GA-JR' }, 'bibliografia', companias)).toEqual([]);
  });
});
