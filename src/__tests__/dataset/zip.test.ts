import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { armarZip } from '../../utils/dataset/zip';

const RUTA = 'Índice de compañías/Índice de compañías.xml';
const CONTENIDO = '<?xml version="1.0" encoding="UTF-8"?>\n<t>ñ á € Compañía</t>\n';

describe('armarZip', () => {
  it('conserva rutas y contenido con Í, ñ, á y € al reabrirlo', async () => {
    const bytes = await armarZip(
      [
        { ruta: 'README.md', contenido: '# Título ñ\n' },
        { ruta: RUTA, contenido: CONTENIDO },
      ],
      new Date('2026-11-06T12:00:00Z'),
    );
    const zip = await JSZip.loadAsync(bytes);
    expect(Object.keys(zip.files)).toContain(RUTA);
    expect(await zip.file(RUTA)?.async('string')).toBe(CONTENIDO);
    expect(zip.file('README.md')).not.toBeNull();
    expect(await zip.file('README.md')?.async('string')).toBe('# Título ñ\n');
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
