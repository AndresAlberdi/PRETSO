import { describe, it, expect } from 'vitest';
import { construirIndice, buscarEnIndice, coincidenciasRegistro } from '../../utils/busquedaGuia/indiceBusqueda';

const companias = [
  { 'Indicador de registro': 7, 'Sigla Compañía': 'Alberto de Ávila', 'Nombre Compañía': 'Compañía de Ávila', Autores: 'Ávila' },
  { 'Indicador de registro': 8, 'Sigla Compañía': 'Cisneros', 'Nombre Compañía': 'Compañía de Cisneros', 'Temporadas teatrales': 'De 1580 a 1581' },
];
const datos = {
  companias,
  manejo_de_caja: [
    { 'Indicador de registro': 1, 'Sigla Compañía': 7, Año: 1581, Ciudad: 'Madrid', 'Datos sobre normativa de manejo de caja': 'Alberto secreto' },
    { 'Indicador de registro': 2, 'Sigla Compañía': 8, Año: 1590, Ciudad: 'Sevilla' },
    { 'Indicador de registro': 3, 'Sigla Compañía': 8, Año: 1600, Ciudad: 'Cádiz', Transacción: 1 },
    { 'Indicador de registro': 4, 'Sigla Compañía': 8, Año: 1601, Ciudad: 'Cádiz', Transacción: 3 },
    { 'Indicador de registro': 5, 'Sigla Compañía': 8, Año: 1602, Ciudad: 'Cádiz', Transacción: 99 },
  ],
  bibliografia: [{ Autores: 'Alberto Pérez', 'Referencias bibliográficas': 'Obra' }],
  transacciones: [
    { Num: 1, Noticia: 'Pago de la fiesta a Bernal', Doc1: 'x', Doc3: 'Libro de cuentas' },
    { Num: 3, Noticia: 'Sin nada', Doc1: 20, Doc2: 21, Doc3: 77 },
    { Num: 2, Noticia: null, Doc3: 5 },
    null,
    'texto roto',
  ],
  documentos: [{ Doc: 1, Documento: 'Carta' }, { Doc: 20, Documento: 'Recibo de Zamora' }, { Doc: 21, Documento: 'Otro' }],
  corpus_christi: [{ Ciudad: 'Toledo', Año: 1585, Compañía: 8 }],
  indicadores: [{ Años: 'de 1580 (marzo) a 1583', Categorías: 'Precios', Concepto: 'Trigo' }],
};

const indice = construirIndice(datos);
const colecciones = (t: string, admin = false) => buscarEnIndice(indice, t, { incluirAdmin: admin }).map(s => s.coleccion);

describe('buscarEnIndice', () => {
  it('«Alberto» aparece en caja (por la sigla) y en bibliografía (autor)', () => {
    expect(colecciones('Alberto')).toEqual(['manejo_de_caja', 'companias', 'bibliografia']);
  });
  it('agrupa las unidades de la sección', () => {
    const caja = buscarEnIndice(indice, 'alberto').find(s => s.coleccion === 'manejo_de_caja')!;
    expect(caja.unidades).toEqual([{ nombre: 'Alberto de Ávila', parametros: { compania: '7' } }]);
  });
  it('el número de compañía «7» no coincide', () => {
    expect(colecciones('7')).toEqual([]);
  });
  it('el lector no recibe secciones de administrador', () => {
    expect(colecciones('fiesta')).toEqual(['manejo_de_caja']); // solo por el enlace, nunca como sección
    expect(colecciones('carta')).toEqual([]);
  });
  it('el administrador recibe Transacciones y Documentos', () => {
    expect(colecciones('fiesta', true)).toEqual(['manejo_de_caja', 'transacciones']);
    expect(colecciones('carta', true)).toEqual(['documentos']);
  });
  it('un campo retirado no se busca', () => {
    expect(colecciones('secreto')).toEqual([]);
  });
  it('«De 1580 a 1581» coincide con 1581 y con 1580', () => {
    const r = buscarEnIndice(indice, '1581');
    expect(r.map(s => s.coleccion)).toEqual(['manejo_de_caja', 'indicadores', 'companias']);
    expect(colecciones('1580')).toEqual(['indicadores', 'companias']);
  });
  it('rango con mes: un año intermedio coincide', () => {
    expect(colecciones('1582')).toEqual(['indicadores']);
  });
  it('año fuera de rango no coincide', () => {
    expect(colecciones('1584')).toEqual([]);
  });
  it('corpus: unidad ciudad y año; compañía por su sigla', () => {
    const c = buscarEnIndice(indice, 'cisneros').find(s => s.coleccion === 'corpus_christi')!;
    expect(c.unidades).toEqual([{ nombre: 'Toledo 1585', parametros: { ciudad: 'Toledo', anio: '1585' } }]);
  });
  it('indicadores: unidad por categoría', () => {
    const c = buscarEnIndice(indice, 'trigo')[0];
    expect(c.unidades).toEqual([{ nombre: 'Precios', parametros: { categoria: 'Precios' } }]);
  });
});

describe('coincidenciasRegistro', () => {
  const tr = datos.transacciones;
  const campos = (r: unknown, _c: string, t: string) => coincidenciasRegistro(indice, r, t).campos.map(x => x.campo);
  it('solo en Noticia', () => {
    expect(campos(tr[0], 'transacciones', 'bernal')).toEqual(['Noticia']);
  });
  it('solo en Doc3', () => {
    expect(campos(tr[0], 'transacciones', 'cuentas')).toEqual(['Doc3']);
  });
  it('transacción con campos nulos o registro roto no falla', () => {
    expect(campos(tr[2], 'transacciones', 'bernal')).toEqual([]);
    expect(campos(tr[2], 'transacciones', '555')).toEqual([]);
    expect(campos(null, 'transacciones', 'abc')).toEqual([]);
    expect(campos('x', 'transacciones', 'abc')).toEqual([]);
    expect(campos({}, 'inexistente', 'abc')).toEqual([]);
  });
  it('construirIndice ignora registros rotos', () => {
    expect(indice.entradas.filter(e => e.coleccion === 'transacciones')).toHaveLength(3);
  });
  it('usa la entrada ya indexada, con compañías resueltas', () => {
    expect(campos(datos.manejo_de_caja[0], 'manejo_de_caja', 'alberto')).toEqual(['Sigla Compañía']);
  });
});

describe('enlace anidado', () => {
  const caja = (n: number) => buscarEnIndice(indice, 'bernal').find(s => s.coleccion === 'manejo_de_caja')!.registros.find(r => r.registro['Indicador de registro'] === n);

  it('sube la caja cuando el término solo está en la Noticia de su transacción', () => {
    const r = caja(3)!;
    expect(r.transaccion).toBe(true);
    expect(r.coincidencias).toEqual([]);
    expect(r.documentos).toEqual([]);
  });
  it('sube la caja cuando el término solo está en un Documento enlazado', () => {
    const s = buscarEnIndice(indice, 'zamora').find(x => x.coleccion === 'manejo_de_caja')!;
    expect(s.registros).toHaveLength(1);
    expect(s.registros[0].transaccion).toBe(false);
    expect(s.registros[0].documentos).toEqual([20]);
    expect(s.unidades).toEqual([{ nombre: 'Cisneros', parametros: { compania: '8' } }]);
  });
  it('los lectores también ven el enlace, sin secciones de administrador', () => {
    expect(colecciones('zamora')).toEqual(['manejo_de_caja']);
    expect(colecciones('bernal')).toEqual(['manejo_de_caja']);
  });
  it('transacción inexistente o Doc roto no falla ni coincide', () => {
    expect(caja(5)).toBeUndefined();
    const s = buscarEnIndice(indice, 'zamora').find(x => x.coleccion === 'manejo_de_caja')!;
    expect(s.registros.map(r => r.registro['Indicador de registro'])).toEqual([4]);
  });
  it('coincidenciasRegistro informa transaccion y documentos', () => {
    const c = (n: number, t: string) => coincidenciasRegistro(indice, datos.manejo_de_caja[n], t);
    expect(c(2, 'bernal')).toMatchObject({ transaccion: true, documentos: [] });
    expect(c(3, 'zamora')).toMatchObject({ transaccion: false, documentos: [20] });
    expect(c(4, 'zamora')).toMatchObject({ transaccion: false, documentos: [] });
  });
  it('un documento repetido en Doc1 y Doc3 cuenta una vez', () => {
    const ind = construirIndice({
      manejo_de_caja: [{ Transacción: 1 }],
      transacciones: [{ Num: 1, Doc1: 20, Doc3: 20, Doc4: 21 }],
      documentos: [{ Doc: 20, Documento: 'Recibo' }, { Doc: 21, Documento: 'Recibo' }],
    });
    const r = buscarEnIndice(ind, 'recibo')[0].registros[0];
    expect(r.documentos).toEqual([20, 21]);
  });
  it('el enlace de documentos es estricto en el tipo, como TransactionModal', () => {
    const ind = construirIndice({
      manejo_de_caja: [{ Transacción: 1 }],
      transacciones: [{ Num: 1, Doc1: '20' }],
      documentos: [{ Doc: 20, Documento: 'Recibo' }],
    });
    expect(buscarEnIndice(ind, 'recibo')).toEqual([]);
  });
  it('colecciones restringe la búsqueda', () => {
    expect(buscarEnIndice(indice, 'alberto', { colecciones: ['bibliografia'] }).map(s => s.coleccion)).toEqual(['bibliografia']);
  });
});

describe('término inválido', () => {
  it('buscarEnIndice devuelve vacío', () => {
    expect(colecciones('de')).toEqual([]);
    expect(colecciones('con')).toEqual([]);
    expect(colecciones('')).toEqual([]);
  });
});

describe('rendimiento', () => {
  const larga = 'Texto largo de prueba sobre pagos de la compañía a los músicos en la fiesta. '.repeat(20);
  const registros = Array.from({ length: 1000 }, (_, i) => ({
    'Indicador de registro': i, 'Sigla Compañía': 7, Año: 1500 + (i % 100), Ciudad: `Ciudad ${i}`, Ingresos: larga, Egresos: larga + i,
    Transacción: i % 50,
  }));
  const transacciones = Array.from({ length: 50 }, (_, i) => ({ Num: i, Noticia: larga, Doc1: i }));
  const documentos = Array.from({ length: 50 }, (_, i) => ({ Doc: i, Documento: larga }));
  const ind = construirIndice({ companias, manejo_de_caja: registros, transacciones, documentos });

  it('precalcula el texto normalizado de cada campo', () => {
    expect(ind.entradas[0].campos.every(c => c.normal === c.normal.toLowerCase() && c.normal !== '')).toBe(true);
  });
  it('comparte los nodos de transacción y documento entre registros', () => {
    expect(ind.entradas[0].enlace.transaccion).toBe(ind.entradas[50].enlace.transaccion);
  });
  it('busca en 1000 registros sin coincidencia en un tiempo holgado', () => {
    const t0 = performance.now();
    const r = buscarEnIndice(ind, 'zzzzz');
    expect(r).toEqual([]);
    expect(performance.now() - t0).toBeLessThan(1000);
  });
  it('encuentra en los 1000 registros y comparte el resultado de la transacción', () => {
    const r = buscarEnIndice(ind, 'músicos');
    expect(r[0].registros).toHaveLength(1000);
    expect(r[0].registros.every(x => x.transaccion)).toBe(true);
  });
});
