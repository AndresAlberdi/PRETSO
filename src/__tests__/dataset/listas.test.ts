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
    const hijos = Array.from(doc.getElementsByTagName('company')[0].children).map((e) => e.tagName);
    expect(hijos).toEqual(['company_code', 'company_name', 'authors', 'theatrical_seasons', 'company_index', 'scope']);
  });

  it('indicador vacío o nulo va al final, estable', () => {
    const d2 = datos({
      companias: [
        { 'Indicador de registro': '', 'Sigla Compañía': 'V1' },
        { 'Indicador de registro': 2, 'Sigla Compañía': 'B' },
        { 'Indicador de registro': null, 'Sigla Compañía': 'V2' },
        { 'Indicador de registro': 1, 'Sigla Compañía': 'A' },
      ],
    });
    const doc = parsear(generarIndiceCompanias(d2, FECHA).archivos[0].contenido);
    expect(textos(doc, 'company_code')).toEqual(['A', 'B', 'V1', 'V2']);
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

  it('conserva las repetidas y sin número al final, con number_status', () => {
    const d = datos({
      transacciones: [
        { Num: 1, Noticia: 'primera' },
        { Num: '1.0', Noticia: 'segunda', Doc1: 'D1' },
        { Num: '', Noticia: 'sin número' },
        { Num: 0.5 - 0.5 + 2, Noticia: 'otra' },
      ],
      documentos: [{ Doc: 'D1', Documento: 'T' }],
    });
    const a = generarListaTransacciones(d, construirEnlaces(d), FECHA).archivos[0];
    expect(a.registros).toBe(4);
    const doc = parsear(a.contenido);
    expect(textos(doc, 'record_count')).toEqual(['4']);
    const tx = Array.from(doc.getElementsByTagName('transaction'));
    expect(tx.map((x) => x.getAttribute('number_status'))).toEqual([null, null, 'duplicate', 'missing']);
    expect(textos(doc, 'transaction_news')).toEqual(['primera', 'otra', 'segunda', 'sin número']);
    expect(tx[2].querySelector('document_text')?.textContent).toBe('T');
  });

  it('indicador vacío o no numérico va al final, estable', () => {
    const d = datos({ transacciones: [{ Num: 'x1' }, { Num: 3 }, { Num: 'x2' }, { Num: 1 }] });
    const a = generarListaTransacciones(d, construirEnlaces(d), FECHA).archivos[0];
    expect(textos(parsear(a.contenido), 'transaction_number')).toEqual(['1', '3', 'x1', 'x2']);
  });

  it('escapa &, < y comillas en el texto del documento', () => {
    const d = datos({
      transacciones: [{ Num: 1, Doc1: 'D1' }],
      documentos: [{ Doc: 'D1', Documento: 'A & B <c> "d" \'e\'' }],
    });
    const a = generarListaTransacciones(d, construirEnlaces(d), FECHA).archivos[0];
    expect(textos(parsear(a.contenido), 'document_text')).toEqual(['A & B <c> "d" \'e\'']);
  });

  it('sin transacciones emite <transactions/> y record_count 0', () => {
    const a = generarListaTransacciones(datos({}), construirEnlaces(datos({})), FECHA).archivos[0];
    const doc = parsear(a.contenido);
    expect(doc.getElementsByTagName('transactions')[0].children).toHaveLength(0);
    expect(textos(doc, 'record_count')).toEqual(['0']);
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

  it('sin Autores va al final y sin datos emite <bibliographies/>', () => {
    const d = datos({ bibliografia: [{ 'Referencias bibliográficas': 'S' }, { Autores: 'Zúñiga' }, { Autores: 'Álvarez' }] });
    const doc = parsear(generarBibliografia(d, FECHA).archivos[0].contenido);
    expect(textos(doc, 'authors')).toEqual(['Álvarez', 'Zúñiga', '']);
    const vacio = parsear(generarBibliografia(datos({}), FECHA).archivos[0].contenido);
    expect(vacio.getElementsByTagName('bibliographies')[0].children).toHaveLength(0);
  });
});
