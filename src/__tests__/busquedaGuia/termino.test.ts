import { describe, it, expect } from 'vitest';
import { validarTermino, CONECTORES } from '../../utils/busquedaGuia/termino';
import { buscarTramos } from '../../utils/busquedaGuia/coincidencias';

describe('validarTermino', () => {
  it('vacío', () => {
    expect(validarTermino('')).toEqual({ ok: false, motivo: 'vacio' });
    expect(validarTermino('   ')).toEqual({ ok: false, motivo: 'vacio' });
    expect(validarTermino(null)).toEqual({ ok: false, motivo: 'vacio' });
  });
  it('corto', () => {
    expect(validarTermino('a')).toEqual({ ok: false, motivo: 'corto' });
    expect(validarTermino('en')).toEqual({ ok: false, motivo: 'corto' });
    expect(validarTermino(' 7 ')).toEqual({ ok: false, motivo: 'corto' });
  });
  it('conector', () => {
    expect(validarTermino('con')).toEqual({ ok: false, motivo: 'conector' });
    expect(validarTermino('SEGÚN')).toEqual({ ok: false, motivo: 'conector' });
    expect(validarTermino('de la')).toEqual({ ok: false, motivo: 'conector' });
  });
  it('válidos', () => {
    expect(validarTermino('AN1')).toEqual({ ok: true, termino: 'an1' });
    expect(validarTermino('1581')).toEqual({ ok: true, termino: '1581' });
    expect(validarTermino('Caja de la Compañía')).toEqual({ ok: true, termino: 'caja de la compania' });
  });
  it('la lista no tiene tildes ni repeticiones', () => {
    for (const c of CONECTORES) expect(c).toBe(c.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase());
  });
});

describe('buscarTramos con término inválido', () => {
  it('devuelve vacío', () => {
    expect(buscarTramos('de la caja', 'de')).toEqual([]);
    expect(buscarTramos('de la caja', 'de la')).toEqual([]);
    expect(buscarTramos('caja de la compañía', 'caja de la compañía')).toHaveLength(1);
  });
});
