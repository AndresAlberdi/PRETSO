import { describe, it, expect } from 'vitest';
import { etiquetaCampo } from '../utils/etiquetas';

describe('etiquetaCampo', () => {
  it.each([
    ['Num', 'Nro.'],
    ['Sigla Compañía', 'Compañía'],
    ['Beneficiario ', 'Beneficiario'],
    ['Encargado ', 'Encargado'],
    ['Categorías', 'Categoría'],
  ])('«%s» se muestra como «%s»', (campo, esperado) => {
    expect(etiquetaCampo(campo)).toBe(esperado);
  });

  it.each(['Indicador de registro', 'Cmp', 'Compañía2', 'toString', ''])(
    '«%s» queda sin cambio', (campo) => {
      expect(etiquetaCampo(campo)).toBe(campo);
    });
});
