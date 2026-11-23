import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { armarZip } from '../../utils/dataset/zip';

const RUTA = 'Índice de compañías/Índice de compañías.xml';
const CONTENIDO = '<?xml version="1.0" encoding="UTF-8"?>\n<t>ñ á € Compañía</t>\n';

describe('armarZip', () => {
  it('conserva rutas y contenido con Í, ñ, á y € al reabrirlo', async () => {
    const blob = await armarZip(
      [
        { ruta: 'README.pdf', contenido: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0xff, 0xfe, 0x80]) },
        { ruta: RUTA, contenido: CONTENIDO },
      ],
      new Date('2026-11-06T12:00:00Z'),
    );
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    expect(Object.keys(zip.files)).toContain(RUTA);
    expect(await zip.file(RUTA)?.async('string')).toBe(CONTENIDO);
    expect(zip.file('README.pdf')).not.toBeNull();
    expect(Array.from((await zip.file('README.pdf')?.async('uint8array')) ?? [])).toEqual([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0xff, 0xfe, 0x80]);
  });

  it('todas las entradas, carpetas incluidas, llevan la fecha de generación', async () => {
    const fecha = new Date('2026-11-06T12:00:00Z');
    const blob = await armarZip([{ ruta: RUTA, contenido: CONTENIDO }, { ruta: 'README.pdf', contenido: new Uint8Array([1]) }], fecha);
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const entradas = Object.values(zip.files);
    expect(entradas.length).toBe(3);
    for (const e of entradas) expect(e.date.getTime()).toBe(fecha.getTime());
  });

  it('un XML de texto no empieza con BOM', async () => {
    const blob = await armarZip([{ ruta: 'a.xml', contenido: '<t/>\n' }], new Date());
    const zip = await JSZip.loadAsync(await blob.arrayBuffer());
    const crudo = await zip.file('a.xml')!.async('uint8array');
    expect(Array.from(crudo.slice(0, 3))).not.toEqual([0xef, 0xbb, 0xbf]);
  });

  it('rechaza rutas duplicadas, también si solo difieren en mayúsculas o tildes', async () => {
    const fecha = new Date();
    await expect(
      armarZip([{ ruta: 'a/B.xml', contenido: '1' }, { ruta: 'a/B.xml', contenido: '2' }], fecha),
    ).rejects.toThrow('Ruta duplicada en el dataset: a/B.xml');
    await expect(
      armarZip([{ ruta: 'Caja/Ñu.xml', contenido: '1' }, { ruta: 'caja/ñu.xml', contenido: '2' }], fecha),
    ).rejects.toThrow('Ruta duplicada en el dataset');
  });
});
