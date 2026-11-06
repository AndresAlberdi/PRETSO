import { describe, expect, it } from 'vitest';
import { construirEnlaces } from '../../utils/dataset/enlaces';
import { generarBibliografia, generarIndiceCompanias, generarListaTransacciones } from '../../utils/dataset/listas';
import { contarAvisos, type DatosDataset } from '../../utils/dataset/tipos';

const FECHA = new Date('2026-11-06T12:00:00.000Z');

function datos(parcial: Partial<DatosDataset>): DatosDataset {
  return {
    companias: [],
    manejo_de_caja: [],
    salarios: [],
    corpus_christi: [],
    transacciones: [],
    documentos: [],
    bibliografia: [],
    ...parcial,
  };
}

function parsear(xml: string): Document {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
  return doc;
}

const textos = (doc: Document, tag: string) => Array.from(doc.getElementsByTagName(tag)).map((e) => e.textContent);

describe('generarIndiceCompanias', () => {
  const d = datos({
    companias: [
      { 'Indicador de registro': 3, 'Sigla Compañía': 'C', 'Nombre Compañía': 'Tres', id: 'x' },
      { 'Indicador de registro': 1, 'Sigla Compañía': 'A', 'Nombre Compañía': 'Uno' },
      { 'Indicador de registro': 2, 'Sigla Compañía': 'B', 'Nombre Compañía': 'Dos' },
    ],
  });

  it('genera un archivo ordenado por indicador, sin record_indicator', () => {
    const r = generarIndiceCompanias(d, FECHA);
    expect(r.archivos).toHaveLength(1);
    const a = r.archivos[0];
    expect(a.nombre).toBe('Índice de compañías');
    expect(a.carpeta).toBe('companias');
    expect(a.unidad).toBe('Todas las compañías');
    expect(a.registros).toBe(3);
    const doc = parsear(a.contenido);
    expect(textos(doc, 'company_code')).toEqual(['A', 'B', 'C']);
    expect(doc.getElementsByTagName('company')).toHaveLength(3);
    expect(textos(doc, 'record_count')).toEqual(['3']);
    expect(a.contenido).not.toContain('record_indicator');
    expect(a.contenido).not.toContain('x</');
  });

  it('con datos vacíos produce un XML válido con cero registros', () => {
    const a = generarIndiceCompanias(datos({}), FECHA).archivos[0];
    parsear(a.contenido);
    expect(a.registros).toBe(0);
  });
});

describe('generarListaTransacciones', () => {
  it('ordena numéricamente [10,2,1] como 1,2,10', () => {
    const d = datos({ transacciones: [{ Num: 10 }, { Num: 2 }, { Num: 1 }] });
    const r = generarListaTransacciones(d, construirEnlaces(d), FECHA);
    const a = r.archivos[0];
    expect(a.nombre).toBe('Lista de transacciones');
    expect(a.unidad).toBe('Todas las transacciones');
    expect(a.registros).toBe(3);
    expect(textos(parsear(a.contenido), 'transaction_number')).toEqual(['1', '2', '10']);
  });

  it('coloca al final los números no numéricos', () => {
    const d = datos({ transacciones: [{ Num: 'abc' }, { Num: 5 }, { Num: 1 }] });
    const a = generarListaTransacciones(d, construirEnlaces(d), FECHA).archivos[0];
    expect(textos(parsear(a.contenido), 'transaction_number')).toEqual(['1', '5', 'abc']);
  });

  it('anida los textos completos de 3 documentos', () => {
    const d = datos({
      transacciones: [{ Num: 1, Noticia: 'N', Doc1: 'D1', Doc2: 'D2', Doc3: 'D3' }],
      documentos: [
        { Doc: 'D1', Documento: 'Texto uno' },
        { Doc: 'D2', Documento: 'Texto dos' },
        { Doc: 'D3', Documento: 'Texto tres' },
      ],
    });
    const r = generarListaTransacciones(d, construirEnlaces(d), FECHA);
    const doc = parsear(r.archivos[0].contenido);
    expect(textos(doc, 'document_text')).toEqual(['Texto uno', 'Texto dos', 'Texto tres']);
    expect(doc.querySelectorAll('transaction > documents > document')).toHaveLength(3);
    expect(contarAvisos(r.avisos).documentosNoEncontrados).toBe(0);
  });

  it('marca found="false" para un documento inexistente y lo cuenta', () => {
    const d = datos({ transacciones: [{ Num: 1, Doc1: 'NOEXISTE' }] });
    const r = generarListaTransacciones(d, construirEnlaces(d), FECHA);
    const doc = parsear(r.archivos[0].contenido);
    expect(doc.querySelector('document')?.getAttribute('found')).toBe('false');
    expect(contarAvisos(r.avisos).documentosNoEncontrados).toBe(1);
  });

  it('no repite transacciones con el mismo número', () => {
    const d = datos({ transacciones: [{ Num: 1, Noticia: 'primera' }, { Num: '1.0', Noticia: 'segunda' }, { Num: '' }] });
    const r = generarListaTransacciones(d, construirEnlaces(d), FECHA);
    expect(r.archivos[0].registros).toBe(1);
    expect(textos(parsear(r.archivos[0].contenido), 'transaction_news')).toEqual(['primera']);
  });
});

describe('generarBibliografia', () => {
  it('ordena por Autores con criterio español (Álvarez antes de Benítez)', () => {
    const d = datos({
      bibliografia: [
        { Autores: 'Benítez', 'Referencias bibliográficas': 'R2' },
        { Autores: 'Zúñiga', 'Referencias bibliográficas': 'R3' },
        { Autores: 'Álvarez', 'Referencias bibliográficas': 'R1' },
      ],
    });
    const a = generarBibliografia(d, FECHA).archivos[0];
    expect(a.nombre).toBe('Bibliografía');
    expect(a.unidad).toBe('Toda la bibliografía');
    expect(a.registros).toBe(3);
    const doc = parsear(a.contenido);
    expect(textos(doc, 'authors')).toEqual(['Álvarez', 'Benítez', 'Zúñiga']);
    expect(textos(doc, 'record_count')).toEqual(['3']);
    expect(doc.getElementsByTagName('bibliography')).toHaveLength(3);
  });
});
