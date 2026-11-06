import { describe, it, expect } from 'vitest';
import { generarReadme } from '../../utils/dataset/readme';
import { CARPETAS, type ResumenDataset } from '../../utils/dataset/tipos';

const resumen: ResumenDataset = {
  generadoEn: new Date('2026-11-06T09:05:30.000Z'),
  carpetas: [
    { carpeta: 'caja', archivos: 4, registros: 11, unidadesSinRegistros: 2 },
    { carpeta: 'remuneraciones', archivos: 5, registros: 23, unidadesSinRegistros: 3 },
    { carpeta: 'corpus', archivos: 6, registros: 37, unidadesSinRegistros: 0 },
    { carpeta: 'companias', archivos: 1, registros: 41, unidadesSinRegistros: 0 },
    { carpeta: 'transacciones', archivos: 1, registros: 53, unidadesSinRegistros: 0 },
    { carpeta: 'bibliografia', archivos: 1, registros: 67, unidadesSinRegistros: 0 },
  ],
  avisos: { transaccionesNoEncontradas: 7, documentosNoEncontrados: 8, registrosSinUnidad: 9 },
};

describe('generarReadme', () => {
  const md = generarReadme(resumen);

  it('nombra las seis carpetas exactas', () => {
    for (const nombre of Object.values(CARPETAS)) expect(md).toContain(`\`${nombre}/\``);
    expect(md).toContain('`Manejo de caja/`');
  });

  it('declara UTF-8 y la fecha en UTC', () => {
    expect(md).toContain('UTF-8');
    expect(md).toContain('Generado el 2026-11-06 09:05 UTC');
  });

  it('refleja los conteos del resumen', () => {
    expect(md).toContain('4 archivos, 11 registros');
    expect(md).toContain('5 archivos, 23 registros');
    expect(md).toContain('6 archivos, 37 registros');
    expect(md).toContain('41 registros.');
    expect(md).toContain('53 registros.');
    expect(md).toContain('67 registros.');
    expect(md).toContain('Compañías sin registros de caja: 2; sin remuneraciones: 3.');
    expect(md).toContain('Transacciones citadas y no encontradas: 7. Documentos citados y no encontrados: 8.');
    expect(md).toContain('Registros sin compañía o sin ciudad y año: 9;');
  });

  it('nombra Identificación de indicadores solo en «Qué no incluye»', () => {
    const apariciones = md.split('Identificación de indicadores').length - 1;
    expect(apariciones).toBe(1);
    expect(md.indexOf('Identificación de indicadores')).toBeGreaterThan(md.indexOf('## Qué no incluye'));
    expect(md).not.toContain('`Identificación de indicadores/`');
  });

  it('explica las transacciones con número repetido o vacío', () => {
    expect(md).toContain('number_status="duplicate"');
    expect(md).toContain('number_status="missing"');
  });

  it('incluye ejemplos de esquema y los marcadores de cita y licencia', () => {
    expect(md).toContain('<pretso_dataset>');
    expect(md).toContain('found="false"');
    expect(md).toContain('## Cómo citar y licencia');
  });
});
