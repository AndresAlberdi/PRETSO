import { describe, it, expect, vi, beforeEach } from 'vitest';
import ExcelJS from 'exceljs';

const datos: Record<string, Record<string, unknown>[]> = {};

vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, name: string) => name,
  query: (name: string) => name,
  getDocs: async (name: string) => ({
    docs: (datos[name] || []).map(d => ({ data: () => d })),
  }),
}));
vi.mock('../firebase', () => ({ db: {} }));

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
    datos.salarios = [{
      'Indicador de registro': 1,
      'Sigla Compañía': 'ABC',
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
});
