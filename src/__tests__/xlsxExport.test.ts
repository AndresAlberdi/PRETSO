import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';

const datos: Record<string, Record<string, unknown>[]> = {};
const getDocsMock = vi.fn(async (name: string) => ({
  docs: (datos[name] || []).map(d => ({ data: () => d })),
}));

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => name,
  query: (name: string) => name,
  getDocs: (name: string) => getDocsMock(name),
}));
vi.mock('../firebase', () => ({ db: {} }));

import { camposReferenciaCompania } from '../utils/referenciaCompania';
import { generateDatabaseXlsx } from '../utils/xlsxExport';

async function leerLibro(): Promise<ExcelJS.Workbook> {
  const blob = await generateDatabaseXlsx();
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  return wb;
}

function encabezados(wb: ExcelJS.Workbook, hoja: string): string[] {
  const ws = wb.getWorksheet(hoja);
  expect(ws).toBeDefined();
  return (ws!.getRow(1).values as unknown[]).slice(1).map(String);
}

describe('generateDatabaseXlsx', () => {
  beforeEach(() => {
    for (const k of Object.keys(datos)) delete datos[k];
    getDocsMock.mockClear();
    datos.companias = [
      { 'Indicador de registro': 1, 'Sigla Compañía': 'ABC', Autores: 'X' },
      { 'Indicador de registro': 2, 'Sigla Compañía': '', 'Nombre Compañía': 'Sin Sigla SA' },
    ];
    datos.salarios = [{
      'Indicador de registro': 1,
      'Sigla Compañía': 1,
      'Año': 1700,
      'Ciudad': 'Potosí',
      'Beneficiario ': 'Juan',
      'Encargo': 'Actor',
      'Monto a pagar': 100,
      'Transacción': 5,
      'Ración diaria': 2,
      'Pago por representación': 3,
      'Días de ración en un año': 365,
      'Número estimado de representaciones por año': 10,
      'Número de representaciones  por año ': 12,
    }];
  });

  it('la hoja Remuneraciones tiene solo las columnas A a J', async () => {
    const wb = await leerLibro();
    expect(encabezados(wb, 'Remuneraciones')).toEqual([
      'Indicador de registro', 'Sigla Compañía', 'Año', 'Ciudad', 'Beneficiario',
      'Encargo', 'Monto a pagar', 'Transacción', 'Ración diaria', 'Pago por representación',
    ]);
  });

  it('no emite los campos de días y representaciones aunque el documento los traiga', async () => {
    const wb = await leerLibro();
    const ws = wb.getWorksheet('Remuneraciones')!;
    expect(ws.columnCount).toBe(10);
    const fila = (ws.getRow(2).values as unknown[]).slice(1);
    expect(fila).toHaveLength(10);
    expect(fila).not.toContain(365);
    expect(fila).not.toContain(12);
    expect(fila[9]).toBe(3);
  });

  it('Manejo de Caja e Indicadores conservan sus encabezados', async () => {
    const wb = await leerLibro();
    expect(encabezados(wb, 'Manejo de Caja')).toEqual([
      'Indicador de registro', 'Sigla Compañía', 'Año', 'Ciudad', 'Ingresos', 'Egresos',
      'Otros bienes de la compañía', 'Transacción', 'Datos sobre normativa de manejo de caja',
    ]);
    expect(encabezados(wb, 'Indicadores')).toEqual([
      'Indicador de registro', 'Ciudad', 'Años', 'Concepto', 'Monto', 'Nota',
      'Categorías', 'Transacción', 'Sigla Compañía',
    ]);
  });

  it('la hoja Transacciones titula «Nro.» la columna Num y conserva el orden', async () => {
    datos.transacciones = [{ Num: 3, Noticia: 'n' }, { Num: 1, Noticia: 'm' }];
    const wb = await leerLibro();
    expect(encabezados(wb, 'Transacciones')).toEqual([
      'Nro.', 'Noticia', 'Fuentes para la generación del dato',
      'Doc1', 'Doc2', 'Doc3', 'Doc4', 'Doc5', 'Doc6', 'Doc7', 'Doc8', 'Doc9', 'Doc10',
    ]);
    const ws = wb.getWorksheet('Transacciones')!;
    expect((ws.getRow(2).values as unknown[])[1]).toBe(1);
    expect((ws.getRow(3).values as unknown[])[1]).toBe(3);
  });

  function celda(wb: ExcelJS.Workbook, hoja: string, fila: number, col: number): unknown {
    return (wb.getWorksheet(hoja)!.getRow(fila).values as unknown[])[col];
  }

  it('Remuneraciones muestra la sigla en lugar del número de compañía', async () => {
    const wb = await leerLibro();
    expect(celda(wb, 'Remuneraciones', 2, 2)).toBe('ABC');
  });

  it('Corpus Christi resuelve todos sus campos de compañía', async () => {
    datos.corpus_christi = [{
      'Indicador de registro': 1, Compañía: 1, Compañía2: 99, Compañía3: '2', Cmp: '1.0', Cmp2: null,
    }];
    const wb = await leerLibro();
    const ws = wb.getWorksheet('Corpus Christi')!;
    const cols = encabezados(wb, 'Corpus Christi');
    const valor = (h: string) => (ws.getRow(2).values as unknown[])[cols.indexOf(h) + 1];
    expect(valor('Compañía')).toBe('ABC');
    expect(valor('Compañía2')).toBe('Compañía no encontrada');
    expect(valor('Compañía3')).toBe('Sin Sigla SA');
    expect(valor('Cmp')).toBe('ABC');
    expect(valor('Cmp2')).toBe('');
  });

  it('Manejo de Caja e Indicadores muestran la sigla', async () => {
    datos.manejo_de_caja = [{ 'Indicador de registro': 1, 'Sigla Compañía': 'abc' }];
    datos.indicadores = [{ 'Indicador de registro': 1, 'Sigla Compañía': 1 }];
    const wb = await leerLibro();
    expect(celda(wb, 'Manejo de Caja', 2, 2)).toBe('ABC');
    expect(celda(wb, 'Indicadores', 2, 9)).toBe('ABC');
  });

  it('ninguna celda de referencia a compañía es un número', async () => {
    datos.manejo_de_caja = [{ 'Indicador de registro': 1, 'Sigla Compañía': 2 }];
    datos.corpus_christi = [{ 'Indicador de registro': 1, Compañía: 1, Compañía2: 99, Cmp: '2.0' }];
    datos.indicadores = [{ 'Indicador de registro': 1, 'Sigla Compañía': 99 }];
    const wb = await leerLibro();
    for (const [coleccion, hoja] of [
      ['manejo_de_caja', 'Manejo de Caja'], ['salarios', 'Remuneraciones'],
      ['corpus_christi', 'Corpus Christi'], ['indicadores', 'Indicadores'],
    ]) {
      const cols = encabezados(wb, hoja);
      for (const campo of camposReferenciaCompania(coleccion)) {
        const idx = cols.indexOf(campo);
        if (idx < 0) continue;
        const v = celda(wb, hoja, 2, idx + 1);
        expect(typeof v).not.toBe('number');
        expect(String(v)).not.toMatch(/^\d+(\.\d+)?$/);
      }
    }
  });

  it('«Indicador de registro» de las hojas de registros conserva su número', async () => {
    datos.manejo_de_caja = [{ 'Indicador de registro': 4, 'Sigla Compañía': 1 }];
    const wb = await leerLibro();
    expect(celda(wb, 'Remuneraciones', 2, 1)).toBe(1);
    expect(celda(wb, 'Manejo de Caja', 2, 1)).toBe(4);
  });

  it('la hoja Compañías no incluye el indicador de registro', async () => {
    const wb = await leerLibro();
    expect(encabezados(wb, 'Compañías')).toEqual([
      'Sigla Compañía', 'Autores', 'Temporadas teatrales', 'Índice de compañías', 'Ámbito',
    ]);
    const ws = wb.getWorksheet('Compañías')!;
    ws.eachRow(row => {
      for (const v of (row.values as unknown[]).slice(1)) {
        expect(v).not.toBe(1);
        expect(v).not.toBe(2);
      }
    });
    expect(celda(wb, 'Compañías', 2, 1)).toBe('ABC');
  });

  it('sin compañías, una referencia numérica no falla y se rotula', async () => {
    datos.companias = [];
    datos.salarios[0]['Sigla Compañía'] = 5;
    const wb = await leerLibro();
    expect(celda(wb, 'Remuneraciones', 2, 2)).toBe('Compañía no encontrada');
  });

  it('lee cada colección exactamente una vez', async () => {
    await generateDatabaseXlsx();
    expect(getDocsMock).toHaveBeenCalledTimes(8);
    const nombres = getDocsMock.mock.calls.map(c => c[0]);
    expect(new Set(nombres).size).toBe(8);
  });
});
