import { describe, it, expect } from 'vitest';
import { filtrarRegistros, normalizarTexto } from '../utils/filtrarRegistros';

const CAMPOS = {
  num: ['Num'],
  noticia: ['Noticia'],
  fuentes: ['Fuentes para la generación del dato'],
  doc: ['Doc1', 'Doc2'],
  all: ['Num', 'Noticia', 'Fuentes para la generación del dato', 'Doc1', 'Doc2'],
};

const datos = [
  { id: 'a', Num: 1, Noticia: 'Pago a García por el carro', 'Fuentes para la generación del dato': 'ALP Caja 3', Doc1: 10, Doc2: 11 },
  { id: 'b', Num: 12, Noticia: 'Compra de TELA', 'Fuentes para la generación del dato': 'AGI Legajo', Doc1: 20 },
  { id: 'c', Num: 3, Noticia: 'Sin fuentes' },
];

const ids = (r: { id: string }[]) => r.map(x => x.id);

describe('filtrarRegistros', () => {
  it('sin filtros devuelve todo', () => {
    expect(filtrarRegistros(datos, [], CAMPOS)).toHaveLength(3);
  });
  it('filtra por cada categoría', () => {
    expect(ids(filtrarRegistros(datos, [{ category: 'num', query: '12' }], CAMPOS))).toEqual(['b']);
    expect(ids(filtrarRegistros(datos, [{ category: 'noticia', query: 'carro' }], CAMPOS))).toEqual(['a']);
    expect(ids(filtrarRegistros(datos, [{ category: 'fuentes', query: 'legajo' }], CAMPOS))).toEqual(['b']);
    expect(ids(filtrarRegistros(datos, [{ category: 'doc', query: '11' }], CAMPOS))).toEqual(['a']);
  });
  it('texto libre busca en todos los campos', () => {
    expect(ids(filtrarRegistros(datos, [{ category: 'all', query: 'alp' }], CAMPOS))).toEqual(['a']);
    expect(ids(filtrarRegistros(datos, [{ category: 'all', query: '20' }], CAMPOS))).toEqual(['b']);
  });
  it('acumula varios filtros (AND)', () => {
    const f = [{ category: 'noticia', query: 'pago' }, { category: 'doc', query: '10' }];
    expect(ids(filtrarRegistros(datos, f, CAMPOS))).toEqual(['a']);
    const g = [{ category: 'noticia', query: 'pago' }, { category: 'doc', query: '20' }];
    expect(filtrarRegistros(datos, g, CAMPOS)).toEqual([]);
  });
  it('sin resultados devuelve lista vacía', () => {
    expect(filtrarRegistros(datos, [{ category: 'all', query: 'zzz' }], CAMPOS)).toEqual([]);
  });
  it('al limpiar los filtros vuelven todos', () => {
    expect(filtrarRegistros(datos, [{ category: 'all', query: 'zzz' }], CAMPOS)).toHaveLength(0);
    expect(filtrarRegistros(datos, [], CAMPOS)).toHaveLength(3);
  });
  it('ignora mayúsculas y tildes', () => {
    expect(ids(filtrarRegistros(datos, [{ category: 'noticia', query: 'garcia' }], CAMPOS))).toEqual(['a']);
    expect(ids(filtrarRegistros(datos, [{ category: 'noticia', query: 'GARCÍA' }], CAMPOS))).toEqual(['a']);
    expect(ids(filtrarRegistros(datos, [{ category: 'noticia', query: 'tela' }], CAMPOS))).toEqual(['b']);
    expect(ids(filtrarRegistros(datos, [{ category: 'fuentes', query: 'generacion' }], CAMPOS))).toEqual([]);
  });
  it('compara valores numéricos como cadena', () => {
    expect(ids(filtrarRegistros(datos, [{ category: 'num', query: '1' }], CAMPOS))).toEqual(['a', 'b']);
  });
  it('tolera campos ausentes y categorías desconocidas', () => {
    expect(ids(filtrarRegistros(datos, [{ category: 'fuentes', query: 'x' }], CAMPOS))).toEqual([]);
    expect(filtrarRegistros(datos, [{ category: 'otra', query: 'a' }], CAMPOS)).toEqual([]);
  });
  it('normalizarTexto maneja nulos', () => {
    expect(normalizarTexto(null)).toBe('');
    expect(normalizarTexto(undefined)).toBe('');
    expect(normalizarTexto('Ñandú')).toBe('nandu');
  });
});
