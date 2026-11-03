import { describe, it, expect } from 'vitest';
import { esConsultaAnio, rangosDeAnios, rangosQueContienen } from '../../utils/busquedaGuia/anios';

const pares = (t: unknown) => rangosDeAnios(t).map(r => [r.desde, r.hasta]);

describe('esConsultaAnio', () => {
  it('solo cuatro dígitos', () => {
    expect(esConsultaAnio('1581')).toBe(true);
    expect(esConsultaAnio(' 1581 ')).toBe(true);
    expect(esConsultaAnio('158')).toBe(false);
    expect(esConsultaAnio('15811')).toBe(false);
    expect(esConsultaAnio('abcd')).toBe(false);
  });
});

describe('rangosDeAnios', () => {
  it('«De AAAA a AAAA»', () => {
    expect(pares('De 1580 a 1581')).toEqual([[1580, 1581]]);
  });
  it('con mes entre paréntesis y espacios múltiples', () => {
    expect(pares('de 1580 (marzo) a 1581 (junio)')).toEqual([[1580, 1581]]);
    expect(pares('de 1580 (marzo) a 1581')).toEqual([[1580, 1581]]);
    expect(pares('De  1580   a   1581')).toEqual([[1580, 1581]]);
  });
  it('«Activa en AAAA» es un año único', () => {
    const r = rangosDeAnios('Activa en 1599 [desconocemos el intervalo de tiempo]');
    expect(r.map(x => [x.desde, x.hasta])).toEqual([[1599, 1599]]);
    expect(r[0].inicio).toBe(0);
    expect(r[0].fin).toBe('Activa en 1599'.length);
  });
  it('«de la década de AAAA a AAAA» toma la década completa como extremo inferior', () => {
    expect(pares('de la década de 1580  a 1590')).toEqual([[1580, 1590]]);
    expect(pares('de la década de 1580 a 1585')).toEqual([[1580, 1589]]);
    expect(pares('de la década de 1584 a 1590')).toEqual([[1580, 1590]]);
  });
  it('número solo es un año exacto', () => {
    expect(pares(1581)).toEqual([[1581, 1581]]);
    expect(pares('1581')).toEqual([[1581, 1581]]);
    expect(pares('1581.0')).toEqual([[1581, 1581]]);
  });
  it('rango invertido: solo los extremos exactos', () => {
    expect(pares('De 1590 a 1580')).toEqual([[1590, 1590], [1580, 1580]]);
    expect(rangosQueContienen('De 1590 a 1580', 1585)).toEqual([]);
  });
  it('amplitud mayor que 100: solo los extremos', () => {
    expect(pares('De 1500 a 1700')).toEqual([[1500, 1500], [1700, 1700]]);
    expect(pares('De 1500 a 1600')).toEqual([[1500, 1600]]);
  });
  it('texto sin años o vacío', () => {
    expect(pares('sin años')).toEqual([]);
    expect(pares(null)).toEqual([]);
    expect(pares('')).toEqual([]);
  });
  it('un número suelto dentro de otro texto no es año', () => {
    expect(pares('Nro. 1581 de la serie')).toEqual([]);
  });
});

describe('rangosQueContienen', () => {
  it('incluye extremos e intermedios (P1)', () => {
    expect(rangosQueContienen('De 1580 a 1585', 1580)).toHaveLength(1);
    expect(rangosQueContienen('De 1580 a 1585', 1583)).toHaveLength(1);
    expect(rangosQueContienen('De 1580 a 1585', 1585)).toHaveLength(1);
    expect(rangosQueContienen('De 1580 a 1585', 1579)).toHaveLength(0);
  });
});
