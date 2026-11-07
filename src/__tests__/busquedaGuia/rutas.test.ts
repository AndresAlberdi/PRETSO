import { describe, it, expect } from 'vitest';
import { enlaceSeccion } from '../../utils/busquedaGuia/rutas';

describe('enlaceSeccion', () => {
  it('codifica el término', () => {
    expect(enlaceSeccion('manejo_de_caja', 'Pérez & «Hijos»')).toBe('/caja?q=P%C3%A9rez+%26+%C2%ABHijos%C2%BB');
  });
  it('añade parámetros de unidad y q no se sobrescribe', () => {
    expect(enlaceSeccion('salarios', 'Lima', { compania: '7', q: 'otro' })).toBe('/salarios?compania=7&q=Lima');
  });
  it('una colección desconocida lanza', () => {
    expect(() => enlaceSeccion('logs', 'Lima')).toThrow();
  });
});
