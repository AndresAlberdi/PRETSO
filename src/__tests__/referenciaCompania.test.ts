import { describe, it, expect } from 'vitest';
import {
  canonizarReferencia, normalizarSigla, resolverCompania, siglaDeReferencia,
  valorDeReferencia, etiquetaCompania, esCampoCompaniaCorpus,
  camposReferenciaCompania, valoresDeBusquedaReferencia, textoVisibleCompania,
  siglaParaExportar,
} from '../utils/referenciaCompania';
import { COLUMN_ORDERS } from '../utils/xlsxExport';

const companias = [
  { id: 'a', 'Indicador de registro': 7.0, 'Sigla Compañía': 'GA-JR', Autores: 'Alarcón y Ramírez' },
  { id: 'b', 'Indicador de registro': 0, 'Sigla Compañía': 'Ñandú', Autores: 'Cero' },
  { id: 'c', 'Indicador de registro': 12, 'Sigla Compañía': 'JG', Autores: 'Juan' },
];

describe('canonizarReferencia', () => {
  it('trata None, indefinido y vacío como cadena vacía', () => {
    expect(canonizarReferencia(null)).toBe('');
    expect(canonizarReferencia(undefined)).toBe('');
    expect(canonizarReferencia('')).toBe('');
    expect(canonizarReferencia('   ')).toBe('');
    expect(canonizarReferencia('None')).toBe('');
    expect(canonizarReferencia('nan')).toBe('');
    expect(canonizarReferencia(NaN)).toBe('');
  });
  it('canoniza 7.0 y "7.0" como 7, y conserva el 0', () => {
    expect(canonizarReferencia(7.0)).toBe('7');
    expect(canonizarReferencia('7.0')).toBe('7');
    expect(canonizarReferencia('7')).toBe('7');
    expect(canonizarReferencia(0)).toBe('0');
  });
  it('conserva el texto no numérico recortado', () => {
    expect(canonizarReferencia(' GA-JR ')).toBe('GA-JR');
  });
});

describe('resolverCompania', () => {
  it('resuelve por número (número, decimal y cadena)', () => {
    expect(resolverCompania(7, companias)?.id).toBe('a');
    expect(resolverCompania('7.0', companias)?.id).toBe('a');
    expect(resolverCompania('12', companias)?.id).toBe('c');
  });
  it('resuelve el número 0', () => {
    expect(resolverCompania(0, companias)?.id).toBe('b');
  });
  it('respalda por sigla normalizada (tildes y mayúsculas)', () => {
    expect(resolverCompania('ga-jr', companias)?.id).toBe('a');
    expect(resolverCompania('NANDU', companias)?.id).toBe('b');
  });
  it('devuelve null si no resuelve o está vacío', () => {
    expect(resolverCompania(99, companias)).toBeNull();
    expect(resolverCompania('XX', companias)).toBeNull();
    expect(resolverCompania(null, companias)).toBeNull();
    expect(resolverCompania('', companias)).toBeNull();
  });
});

describe('siglaDeReferencia y etiquetas', () => {
  it('devuelve la sigla de la compañía resuelta', () => {
    expect(siglaDeReferencia(7, companias)).toBe('GA-JR');
  });
  it('si no resuelve devuelve la referencia canonizada', () => {
    expect(siglaDeReferencia(99.0, companias)).toBe('99');
    expect(siglaDeReferencia(null, companias)).toBe('');
  });
  it('arma la etiqueta «sigla - autores»', () => {
    expect(etiquetaCompania(companias[0])).toBe('GA-JR - Alarcón y Ramírez');
  });
  it('normaliza siglas', () => {
    expect(normalizarSigla(' Ñandú ')).toBe('nandu');
  });
});

describe('valorDeReferencia', () => {
  it('devuelve el número de registro con tipo numérico', () => {
    expect(valorDeReferencia(companias[0])).toBe(7);
    expect(typeof valorDeReferencia(companias[0])).toBe('number');
    expect(valorDeReferencia({ 'Indicador de registro': '12' })).toBe(12);
    expect(valorDeReferencia(companias[1])).toBe(0);
  });
});

describe('esCampoCompaniaCorpus', () => {
  it('reconoce los campos de compañía de Corpus Christi', () => {
    for (const k of ['Compañía', 'Compañía2', 'Compañía10', 'Cmp', 'Cmp2']) expect(esCampoCompaniaCorpus(k)).toBe(true);
    for (const k of ['Ciudad', 'Sigla Compañía', 'Compañía Principal']) expect(esCampoCompaniaCorpus(k)).toBe(false);
  });
});

describe('camposReferenciaCompania', () => {
  it('Corpus Christi: Compañía, Compañía2…10, Cmp y Cmp2, todos reconocidos por esCampoCompaniaCorpus', () => {
    const campos = camposReferenciaCompania('corpus_christi');
    expect(campos).toEqual(COLUMN_ORDERS.corpus_christi.filter(esCampoCompaniaCorpus));
    expect(campos).toHaveLength(12);
    expect(campos).toEqual(expect.arrayContaining(['Compañía', 'Compañía2', 'Compañía10', 'Cmp', 'Cmp2']));
    expect(campos.every(esCampoCompaniaCorpus)).toBe(true);
  });
  it('Caja, Remuneraciones e Indicadores usan Sigla Compañía; otras colecciones, ninguno', () => {
    for (const c of ['manejo_de_caja', 'salarios', 'indicadores']) expect(camposReferenciaCompania(c)).toEqual(['Sigla Compañía']);
    expect(camposReferenciaCompania('documentos')).toEqual([]);
  });
});

describe('valoresDeBusquedaReferencia', () => {
  it('incluye número, texto del número y sigla', () => {
    expect(valoresDeBusquedaReferencia(companias[0])).toEqual([7, '7', 'GA-JR']);
  });
  it('conserva el número 0', () => {
    expect(valoresDeBusquedaReferencia(companias[1])).toEqual([0, '0', 'Ñandú']);
  });
  it('sin número de registro, solo la sigla', () => {
    expect(valoresDeBusquedaReferencia({ 'Sigla Compañía': 'X' })).toEqual(['X']);
  });
});

describe('textoVisibleCompania', () => {
  it('devuelve la sigla recortada', () => {
    expect(textoVisibleCompania({ 'Indicador de registro': 7, 'Sigla Compañía': ' GA-JR ' })).toBe('GA-JR');
  });
  it('con sigla vacía usa el nombre', () => {
    expect(textoVisibleCompania({ 'Indicador de registro': 7, 'Sigla Compañía': '', 'Nombre Compañía': ' Sin Sigla SA ' })).toBe('Sin Sigla SA');
  });
  it('sin sigla ni nombre devuelve el rótulo fijo y nunca el número', () => {
    expect(textoVisibleCompania({ 'Indicador de registro': 7 })).toBe('Compañía sin sigla');
  });
});

describe('siglaParaExportar', () => {
  it('devuelve la sigla por número, decimal o sigla normalizada', () => {
    expect(siglaParaExportar(7, companias)).toBe('GA-JR');
    expect(siglaParaExportar('7.0', companias)).toBe('GA-JR');
    expect(siglaParaExportar('ga-jr ', companias)).toBe('GA-JR');
  });
  it('con sigla vacía devuelve el nombre', () => {
    const lista = [{ 'Indicador de registro': 3, 'Sigla Compañía': '', 'Nombre Compañía': 'Sin Sigla SA' }];
    expect(siglaParaExportar(3, lista)).toBe('Sin Sigla SA');
  });
  it('un número que no resuelve no se expone', () => {
    expect(siglaParaExportar(99, companias)).toBe('Compañía no encontrada');
    expect(siglaParaExportar('99', companias)).toBe('Compañía no encontrada');
  });
  it('un texto que no resuelve se conserva', () => {
    expect(siglaParaExportar('XYZ', companias)).toBe('XYZ');
  });
  it('los valores vacíos dan cadena vacía', () => {
    for (const v of [null, undefined, '', 'None', NaN]) expect(siglaParaExportar(v, companias)).toBe('');
  });
});
