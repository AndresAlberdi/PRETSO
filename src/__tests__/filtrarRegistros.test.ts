import { describe, it, expect } from 'vitest';
import { filtrarRegistros, normalizarTexto } from '../utils/filtrarRegistros';

const CAMPOS = {
  num: { campos: ['Num'], modo: 'exacto' as const },
  noticia: ['Noticia'],
  fuentes: ['Fuentes para la generación del dato'],
  doc: { campos: ['Doc1', 'Doc2'], modo: 'exacto' as const },
  all: ['Num', 'Noticia', 'Fuentes para la generación del dato', 'Doc1', 'Doc2'],
  libre: { campos: ['Num', 'Noticia'], modo: 'contiene' as const },
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
  it('los identificadores numéricos se buscan por igualdad exacta', () => {
    expect(ids(filtrarRegistros(datos, [{ category: 'num', query: '1' }], CAMPOS))).toEqual(['a']);
  });
  it('«5» no trae 15, 50 ni 105', () => {
    const n = [5, 15, 50, 105].map(Num => ({ id: String(Num), Num }));
    expect(ids(filtrarRegistros(n, [{ category: 'num', query: '5' }], CAMPOS))).toEqual(['5']);
  });
  it('acepta el prefijo Doc, Doc., Nro. o N° delante del número', () => {
    const n = [5, 15].map(Num => ({ id: String(Num), Num }));
    for (const q of ['Doc 5', 'Doc. 5', 'doc5', 'Nro. 5', 'N° 5', 'nro 5']) {
      expect(ids(filtrarRegistros(n, [{ category: 'num', query: q }], CAMPOS))).toEqual(['5']);
    }
  });
  it('«7.0» y «7» son iguales cuando ambos lados son numéricos', () => {
    const n = [{ id: 'x', Num: 7 }, { id: 'y', Num: '7.0' }, { id: 'z', Num: 17 }];
    expect(ids(filtrarRegistros(n, [{ category: 'num', query: '7.0' }], CAMPOS))).toEqual(['x', 'y']);
    expect(ids(filtrarRegistros(n, [{ category: 'num', query: '7' }], CAMPOS))).toEqual(['x', 'y']);
  });
  it('el modo exacto no encuentra con consulta vacía tras quitar el prefijo', () => {
    expect(filtrarRegistros(datos, [{ category: 'num', query: 'Doc' }], CAMPOS)).toEqual([]);
  });
  it('«Texto libre» y el modo por defecto siguen siendo «contiene»', () => {
    expect(ids(filtrarRegistros(datos, [{ category: 'libre', query: '1' }], CAMPOS))).toEqual(['a', 'b']);
    expect(ids(filtrarRegistros(datos, [{ category: 'all', query: '1' }], CAMPOS))).toEqual(['a', 'b']);
  });
  it('colapsa espacios y saltos de línea', () => {
    const d = [{ id: 'k', Noticia: 'Carta\nde García' }];
    expect(ids(filtrarRegistros(d, [{ category: 'noticia', query: 'carta de' }], CAMPOS))).toEqual(['k']);
    expect(normalizarTexto('  a \n\t b ')).toBe('a b');
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
