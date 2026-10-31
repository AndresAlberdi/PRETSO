import { describe, it, expect } from 'vitest';
import { textoResultadoBusqueda } from '../utils/textoResultadoBusqueda';

const companias = [
  { 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', 'Nombre Compañía': 'Compañía de Alarcón' },
  { 'Indicador de registro': 12, 'Sigla Compañía': '', 'Nombre Compañía': 'Compañía de Vargas' },
  { 'Indicador de registro': 13 },
];

describe('textoResultadoBusqueda', () => {
  it('manejo_de_caja: sigla en lugar del número, sin «Indicador de registro»', () => {
    const t = textoResultadoBusqueda(
      { id: 'a', 'Indicador de registro': 3, 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600 },
      'manejo_de_caja', companias);
    expect(t).toBe('Compañía: GA-JR | Ciudad: Potosí | Año: 1600');
    expect(t).not.toContain('Indicador de registro');
    expect(t).not.toContain('7');
  });

  it('salarios: referencia «7.0» y Beneficiario sin espacio', () => {
    const t = textoResultadoBusqueda({ 'Sigla Compañía': '7.0', 'Beneficiario ': 'Ana' }, 'salarios', companias);
    expect(t).toContain('Compañía: GA-JR');
    expect(t).toContain('Beneficiario: Ana');
  });

  it('indicadores: sigla heredada y «Categoría»', () => {
    const t = textoResultadoBusqueda({ 'Sigla Compañía': 'GA-JR', 'Categorías': 'Pan' }, 'indicadores', companias);
    expect(t).toContain('Compañía: GA-JR');
    expect(t).toContain('Categoría: Pan');
  });

  it('corpus_christi: sigla, nombre y rótulo sin sigla', () => {
    const t = textoResultadoBusqueda({ 'Compañía': 7, 'Compañía2': 12, 'Cmp': 13 }, 'corpus_christi', companias);
    expect(t).toBe('Compañía: GA-JR | Compañía2: Compañía de Vargas | Cmp: Compañía sin sigla');
  });

  it('corpus_christi: cualquier campo de compañía (Cmp3, Compañía11) muestra sigla o nombre', () => {
    const t = textoResultadoBusqueda({ 'Cmp3': 7, 'Compañía11': 12 }, 'corpus_christi', companias);
    expect(t).toBe('Cmp3: GA-JR | Compañía11: Compañía de Vargas');
  });

  it('referencias que no resuelven', () => {
    const f = (v: unknown) => textoResultadoBusqueda({ 'Sigla Compañía': v }, 'manejo_de_caja', companias);
    expect(f(99)).toBe('Compañía: Compañía no encontrada');
    expect(f('7 / 8')).toBe('Compañía: Compañía no encontrada');
    expect(f('XYZ')).toBe('Compañía: XYZ');
    expect(f('None')).toBe('');
    expect(textoResultadoBusqueda({ 'Sigla Compañía': 7 }, 'manejo_de_caja', []))
      .toBe('Compañía: Compañía no encontrada');
  });

  it('None no cuenta entre los tres campos', () => {
    const t = textoResultadoBusqueda({ 'Sigla Compañía': 'None', Ciudad: 'A', 'Año': 1, Ingresos: 2 }, 'manejo_de_caja', companias);
    expect(t).toBe('Ciudad: A | Año: 1 | Ingresos: 2');
  });

  it('companias: no muestra el número de registro', () => {
    const t = textoResultadoBusqueda(
      { 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', 'Nombre Compañía': 'X' }, 'companias', companias);
    expect(t).toBe('Compañía: GA-JR | Nombre Compañía: X');
  });

  it('transacciones y documentos', () => {
    const t = textoResultadoBusqueda({ Num: 12, Noticia: 'N' }, 'transacciones', companias);
    expect(t).toBe('Nro.: 12 | Noticia: N');
    expect(t).not.toContain('Num:');
    expect(textoResultadoBusqueda({ Doc: 5 }, 'documentos', companias)).toBe('Doc: 5');
  });

  it('límite de tres campos', () => {
    expect(textoResultadoBusqueda({ a: 1, b: 2, c: 3, d: 4 }, 'documentos', companias)).toBe('a: 1 | b: 2 | c: 3...');
    expect(textoResultadoBusqueda({ a: 1, b: 2, c: 3 }, 'documentos', companias)).toBe('a: 1 | b: 2 | c: 3');
    expect(textoResultadoBusqueda({ id: 'x', 'Indicador de registro': 1, a: 0 }, 'documentos', companias)).toBe('');
  });
});
