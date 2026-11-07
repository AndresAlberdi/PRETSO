import { describe, it, expect } from 'vitest';
import { buscarTramos, normalizarConMapa } from '../../utils/busquedaGuia/coincidencias';

const marcados = (t: ReturnType<typeof buscarTramos>) => t.filter(x => x.coincide).map(x => x.texto);

describe('buscarTramos', () => {
  it('ignora tildes y mayúsculas y conserva el texto original', () => {
    const t = buscarTramos('Compañía de José García', 'garcia');
    expect(marcados(t)).toEqual(['García']);
    expect(t.map(x => x.texto).join('')).toBe('Compañía de José García');
  });
  it('encuentra con tilde en la consulta y sin tilde en el texto', () => {
    expect(marcados(buscarTramos('Jose', 'JOSÉ'))).toEqual(['Jose']);
  });
  it('tolera espacios múltiples en el texto', () => {
    expect(marcados(buscarTramos('Juan   de  Mena', 'juan de mena'))).toEqual(['Juan   de  Mena']);
  });
  it('varias palabras son una frase literal', () => {
    expect(buscarTramos('Mena de Juan', 'juan de')).toEqual([]);
    expect(marcados(buscarTramos('Juan de Mena', 'juan de'))).toEqual(['Juan de']);
  });
  it('marca todas las apariciones sin solaparlas', () => {
    expect(marcados(buscarTramos('aaaaaa', 'aaa'))).toEqual(['aaaaaa']);
    expect(marcados(buscarTramos('Pan y pan', 'PAN'))).toEqual(['Pan', 'pan']);
  });
  it('sin coincidencia o con consulta vacía devuelve []', () => {
    expect(buscarTramos('abc', 'x')).toEqual([]);
    expect(buscarTramos('abc', '   ')).toEqual([]);
    expect(buscarTramos(null, 'a')).toEqual([]);
  });
  it('acepta valores numéricos', () => {
    expect(marcados(buscarTramos(1581, '158'))).toEqual(['158']);
  });
  it('un término más largo que el texto no coincide', () => {
    expect(buscarTramos('ab', 'a'.repeat(100))).toEqual([]);
  });
  it('trata los caracteres especiales como texto', () => {
    expect(marcados(buscarTramos('a <script> b', '<script>'))).toEqual(['<script>']);
    expect(marcados(buscarTramos('x.*y', '.*y'))).toEqual(['.*y']);
  });
  it('en campos de año resalta el rango completo', () => {
    const t = buscarTramos('De 1580 a 1585', '1583', { anio: true });
    expect(marcados(t)).toEqual(['De 1580 a 1585']);
  });
  it('en campos de año no coincide fuera del rango', () => {
    expect(buscarTramos('De 1580 a 1585', '1586', { anio: true })).toEqual([]);
  });
  it('fuera de un campo de año, el rango no cuenta', () => {
    expect(marcados(buscarTramos('De 1580 a 1585', '1583'))).toEqual([]);
  });
  it('una consulta de año en campo de año numérico es exacta', () => {
    expect(marcados(buscarTramos(1581, '1581', { anio: true }))).toEqual(['1581']);
    expect(buscarTramos(1581, '1580', { anio: true })).toEqual([]);
  });
  it('en campo de año una consulta que no es año se busca como texto', () => {
    expect(marcados(buscarTramos('Activa en 1599', 'activa', { anio: true }))).toEqual(['Activa']);
  });
});

describe('texto NFD', () => {
  it('una marca combinante suelta se incluye en la coincidencia', () => {
    const nfd = 'Jose\u0301 Perez'.normalize('NFD');
    const t = buscarTramos(nfd, 'jose perez');
    expect(t).toEqual([{ texto: nfd, coincide: true }]);
    expect(marcados(buscarTramos('xJose\u0301y', 'josé'))).toEqual(['Jose\u0301']);
  });
});

describe('normalizarConMapa', () => {
  it('coincide con la normalización compartida', () => {
    expect(normalizarConMapa('  Ñandú\t  Ánimo ').normal).toBe('nandu animo');
  });
  it('mapea cada carácter normalizado a su posición original', () => {
    const m = normalizarConMapa('A  é');
    expect(m.normal).toBe('a e');
    expect(m.inicio).toEqual([0, 1, 3]);
    expect(m.fin).toEqual([1, 3, 4]);
  });
});
