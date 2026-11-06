import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { generarArchivosDataset, generarDatasetZip, nombreZipDataset } from '../../utils/dataset/generarDataset';
import { CARPETAS, type DatosDataset } from '../../utils/dataset/tipos';

const FECHA = new Date('2026-11-06T23:30:00Z');

const datos: DatosDataset = {
  companias: [{ 'Indicador de registro': 7, 'Sigla Compañía': 'GA-AR', 'Nombre Compañía': 'Compañía de Gaspar' }],
  manejo_de_caja: [{ 'Indicador de registro': 1, 'Sigla Compañía': 7, Año: 1600, Ingresos: 'x1' }],
  salarios: [{ 'Indicador de registro': 2, 'Sigla Compañía': 7, Año: 1601 }],
  corpus_christi: [{ 'Indicador de registro': 3, Ciudad: 'Madrid', Año: 1615, Transacciones: '1' }],
  transacciones: [{ Num: 1, Doc1: 'D1' }],
  documentos: [{ Doc: 'D1' }],
  bibliografia: [{ Autores: 'Autor' }],
};

describe('generarArchivosDataset', () => {
  it('produce las rutas esperadas, el README y exactamente seis carpetas', () => {
    const { entradas, resumen } = generarArchivosDataset(datos, FECHA);
    const rutas = entradas.map((e) => e.ruta);
    expect(rutas).toContain('Manejo de caja/GA-AR.xml');
    expect(rutas).toContain('Remuneraciones/GA-AR.xml');
    expect(rutas).toContain('Corpus Christi/Madrid-1615.xml');
    expect(rutas).toContain('README.md');
    expect(rutas[rutas.length - 1]).toBe('README.md');
    const carpetas = new Set(rutas.filter((r) => r.includes('/')).map((r) => r.split('/')[0]));
    expect(carpetas).toEqual(new Set(Object.values(CARPETAS)));
    expect(carpetas.size).toBe(6);
    expect(rutas.some((r) => r.startsWith('Identificación'))).toBe(false);
    expect(resumen.carpetas.map((c) => c.carpeta)).toEqual(Object.keys(CARPETAS));
  });

  it('empaqueta todo en un ZIP legible con el nombre por fecha', async () => {
    const { nombre, bytes } = await generarDatasetZip(datos, FECHA);
    expect(nombre).toBe('PRETSO_dataset_2026-11-06.zip');
    const zip = await JSZip.loadAsync(bytes);
    expect(zip.file('README.md')).not.toBeNull();
    expect(zip.file('Manejo de caja/GA-AR.xml')).not.toBeNull();
  });
});

describe('nombreZipDataset', () => {
  it('usa la fecha UTC', () => {
    expect(nombreZipDataset(FECHA)).toBe('PRETSO_dataset_2026-11-06.zip');
  });
});
