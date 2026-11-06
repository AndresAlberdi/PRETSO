import { describe, it, expect } from 'vitest';
import { construirEnlaces } from '../../utils/dataset/enlaces';
import { generarCarpetaCompania, generarCarpetaCorpus, ordenarPorIndicador } from '../../utils/dataset/porUnidad';
import { contarAvisos, type DatosDataset, type Registro } from '../../utils/dataset/tipos';

const FECHA = new Date('2026-11-06T12:00:00.000Z');

const sinErrores = (x: string) =>
  new DOMParser().parseFromString(x, 'application/xml').getElementsByTagName('parsererror').length === 0;

const datosBase = (parcial: Partial<DatosDataset>): DatosDataset => ({
  companias: [],
  manejo_de_caja: [],
  salarios: [],
  corpus_christi: [],
  transacciones: [],
  documentos: [],
  bibliografia: [],
  ...parcial,
});

const gaspar: Registro = { 'Indicador de registro': 7, 'Sigla Compañía': 'GA-AR', 'Nombre Compañía': 'Compañía de Gaspar', Autores: 'Gaspar' };
const enlacesVacios = construirEnlaces({ transacciones: [], documentos: [] });

describe('generarCarpetaCompania', () => {
  it('agrupa por compañía resuelta, ordena por indicador y emite el encabezado', () => {
    const datos = datosBase({
      companias: [gaspar],
      manejo_de_caja: [
        { 'Indicador de registro': 30, 'Sigla Compañía': '7.0', Año: 1600, Ingresos: 'tercero', id: 'abc' },
        { 'Indicador de registro': 10, 'Sigla Compañía': 7, Año: 1598, Ingresos: 'primero' },
        { 'Indicador de registro': 20, 'Sigla Compañía': 7, Año: 1599, Ingresos: 'segundo' },
      ],
    });
    const r = generarCarpetaCompania('caja', datos, enlacesVacios, FECHA);
    expect(r.archivos).toHaveLength(1);
    const a = r.archivos[0];
    expect(a.nombre).toBe('GA-AR');
    expect(a.carpeta).toBe('caja');
    expect(a.registros).toBe(3);
    expect(a.contenido).toContain('<record_count>3</record_count>');
    expect(a.contenido).toContain('<section>Manejo de caja</section>');
    expect(a.contenido).toContain('<company_name label="Nombre de la compañía">Compañía de Gaspar</company_name>');
    expect(a.contenido.indexOf('primero')).toBeLessThan(a.contenido.indexOf('segundo'));
    expect(a.contenido.indexOf('segundo')).toBeLessThan(a.contenido.indexOf('tercero'));
    expect(a.contenido).toContain('<cash_managements>');
    expect(a.contenido).not.toMatch(/record_indicator|Indicador|<id[ >]|abc/);
    expect(a.contenido).not.toMatch(/<company_code[^>]*>7</);
    expect(sinErrores(a.contenido)).toBe(true);
    expect(contarAvisos(r.avisos).registrosSinUnidad).toBe(0);
  });

  it('sanea la sigla y añade sufijo a nombres repetidos', () => {
    const datos = datosBase({
      companias: [
        { 'Indicador de registro': 1, 'Sigla Compañía': 'GA/AR' },
        { 'Indicador de registro': 2, 'Sigla Compañía': '', 'Nombre Compañía': 'Misma' },
        { 'Indicador de registro': 3, 'Sigla Compañía': '', 'Nombre Compañía': 'Misma' },
      ],
      salarios: [
        { 'Indicador de registro': 1, 'Sigla Compañía': 1 },
        { 'Indicador de registro': 2, 'Sigla Compañía': 2 },
        { 'Indicador de registro': 3, 'Sigla Compañía': 3 },
      ],
    });
    const r = generarCarpetaCompania('remuneraciones', datos, enlacesVacios, FECHA);
    expect(r.archivos.map((a) => a.nombre)).toEqual(['GA-AR', 'Misma', 'Misma-2']);
    expect(r.archivos[0].contenido).toContain('<salaries>');
    expect(r.archivos[0].contenido).toContain('<salary>');
  });

  it('manda a un archivo aparte lo que no resuelve y cuenta las compañías sin registros', () => {
    const datos = datosBase({
      companias: [gaspar, { 'Indicador de registro': 8, 'Sigla Compañía': 'XX' }],
      manejo_de_caja: [
        { 'Indicador de registro': 1, 'Sigla Compañía': 7 },
        { 'Indicador de registro': 2, 'Sigla Compañía': 99 },
        { 'Indicador de registro': 3, 'Sigla Compañía': '' },
      ],
    });
    const r = generarCarpetaCompania('caja', datos, enlacesVacios, FECHA);
    expect(r.archivos.map((a) => a.nombre)).toEqual(['GA-AR', 'Sin compañía identificada']);
    const h = r.archivos[1];
    expect(h.registros).toBe(2);
    expect(h.contenido).toContain('<company_reference found="false" label="Compañía">Compañía no encontrada</company_reference>');
    expect(h.contenido).toContain('<company_reference found="false" label="Compañía"/>');
    expect(h.contenido).not.toContain('<company>');
    expect(contarAvisos(r.avisos).registrosSinUnidad).toBe(2);
    expect(r.unidadesSinRegistros).toBe(1);
    expect(sinErrores(h.contenido)).toBe(true);
  });

  it('no deja salir campos retirados de salarios', () => {
    const datos = datosBase({
      companias: [gaspar],
      salarios: [
        { 'Indicador de registro': 1, 'Sigla Compañía': 7, 'Beneficiario ': 'Juan', 'Días de ración en un año': 'SECRETO1', Moneda: 'SECRETO2' },
      ],
    });
    const x = generarCarpetaCompania('remuneraciones', datos, enlacesVacios, FECHA).archivos[0].contenido;
    expect(x).toContain('Juan');
    expect(x).not.toMatch(/SECRETO|Moneda|ración en un año/);
  });

  it('anida la transacción y marca las inexistentes con found="false"', () => {
    const enlaces = construirEnlaces({
      transacciones: [{ Num: 5, Noticia: 'Pago', Doc1: 1 }],
      documentos: [{ Doc: 1, Documento: 'Texto' }],
    });
    const datos = datosBase({
      companias: [gaspar],
      manejo_de_caja: [
        { 'Indicador de registro': 1, 'Sigla Compañía': 7, Transacción: '5.0' },
        { 'Indicador de registro': 2, 'Sigla Compañía': 7, Transacción: 6 },
      ],
    });
    const r = generarCarpetaCompania('caja', datos, enlaces, FECHA);
    const x = r.archivos[0].contenido;
    expect(x).toContain('<transaction>');
    expect(x).toContain('Texto');
    expect(x).toContain('<transaction found="false">');
    expect(contarAvisos(r.avisos).transaccionesNoEncontradas).toBe(1);
    expect(sinErrores(x)).toBe(true);
  });
});

describe('ordenarPorIndicador', () => {
  it('es estable y deja los no numéricos al final', () => {
    const lista = [
      { 'Indicador de registro': 'x', n: 'a' },
      { 'Indicador de registro': 2, n: 'b' },
      { 'Indicador de registro': 1, n: 'c' },
      { 'Indicador de registro': 2, n: 'd' },
    ];
    expect(ordenarPorIndicador(lista).map((r) => r.n)).toEqual(['c', 'b', 'd', 'a']);
  });
});

describe('generarCarpetaCorpus', () => {
  const companias = [gaspar, { 'Indicador de registro': 8, 'Sigla Compañía': 'ZZ', 'Nombre Compañía': 'Otra' }];

  it('une ciudad y año recortados, y numéricos con texto', () => {
    const datos = datosBase({
      companias,
      corpus_christi: [
        { 'Indicador de registro': 1, Ciudad: ' Madrid ', Año: 1615, Encargo: 'carros' },
        { 'Indicador de registro': 2, Ciudad: 'Madrid', Año: '1615', Encargo: 'danzas' },
      ],
    });
    const r = generarCarpetaCorpus(datos, enlacesVacios, FECHA);
    expect(r.archivos).toHaveLength(1);
    const a = r.archivos[0];
    expect(a.nombre).toBe('Madrid-1615');
    expect(a.registros).toBe(2);
    expect(a.contenido).toContain('<city_year>');
    expect(a.contenido).toContain('<city label="Ciudad">Madrid</city>');
    expect(a.contenido).toContain('<year label="Año">1615</year>');
    expect(a.contenido).toContain('<corpus_christi_records>');
    expect(a.contenido).toContain('<companies/>');
    expect(a.contenido).not.toMatch(/Indicador|record_indicator/);
    expect(sinErrores(a.contenido)).toBe(true);
  });

  it('ordena las unidades por ciudad y año, y manda lo incompleto al archivo aparte', () => {
    const datos = datosBase({
      companias,
      corpus_christi: [
        { Ciudad: 'Sevilla', Año: 1600 },
        { Ciudad: 'Madrid', Año: 1610 },
        { Ciudad: 'Madrid', Año: 99 },
        { Ciudad: 'Madrid' },
        { Año: 1600 },
      ],
    });
    const r = generarCarpetaCorpus(datos, enlacesVacios, FECHA);
    expect(r.archivos.map((a) => a.nombre)).toEqual(['Madrid-99', 'Madrid-1610', 'Sevilla-1600', 'Sin ciudad o año']);
    const h = r.archivos[3];
    expect(h.registros).toBe(2);
    expect(h.contenido).not.toContain('<city_year>');
    expect(h.contenido).toContain('<city label="Ciudad">Madrid</city>');
    expect(contarAvisos(r.avisos).registrosSinUnidad).toBe(2);
    expect(sinErrores(h.contenido)).toBe(true);
  });

  it('lista las compañías sin repetidos y marca las no encontradas', () => {
    const datos = datosBase({
      companias,
      corpus_christi: [
        { Ciudad: 'Madrid', Año: 1615, Compañía: 7, Compañía2: 8, Cmp: '7.0', Cmp2: 99 },
      ],
    });
    const x = generarCarpetaCorpus(datos, enlacesVacios, FECHA).archivos[0].contenido;
    expect(x.match(/<company>/g)).toHaveLength(2);
    expect(x).toContain('<company_code label="Sigla">GA-AR</company_code>');
    expect(x).toContain('<company_name label="Nombre de la compañía">Otra</company_name>');
    expect(x).toContain('<company found="false">');
    expect(x).toContain('Compañía no encontrada');
    expect(x).not.toMatch(/<company_code[^>]*>(7|8|99)</);
    expect(sinErrores(x)).toBe(true);
  });

  it('anida la transacción', () => {
    const enlaces = construirEnlaces({ transacciones: [{ Num: 3, Noticia: 'N' }], documentos: [] });
    const datos = datosBase({
      companias,
      corpus_christi: [{ Ciudad: 'Madrid', Año: 1615, Transacción: 3 }],
    });
    const x = generarCarpetaCorpus(datos, enlaces, FECHA).archivos[0].contenido;
    expect(x).toContain('<transaction>');
    expect(x).toContain('<documents/>');
    expect(sinErrores(x)).toBe(true);
  });
});
