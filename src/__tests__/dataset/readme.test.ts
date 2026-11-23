import { describe, it, expect } from 'vitest';
import type { Content } from 'pdfmake/interfaces';
import { construirDocumentoReadme } from '../../utils/dataset/readme';
import { fechaLarga } from '../../utils/dataset/readmeTexto';
import { CARPETAS, type ResumenDataset } from '../../utils/dataset/tipos';

function resumenCon(parcial: Partial<ResumenDataset> = {}): ResumenDataset {
  return {
    generadoEn: new Date('2026-11-22T23:50:30.000Z'),
    carpetas: [
      { carpeta: 'caja', archivos: 9, registros: 69, unidadesSinRegistros: 10 },
      { carpeta: 'remuneraciones', archivos: 9, registros: 44, unidadesSinRegistros: 10 },
      { carpeta: 'corpus', archivos: 18, registros: 21, unidadesSinRegistros: 0 },
      { carpeta: 'companias', archivos: 1, registros: 19, unidadesSinRegistros: 0 },
      { carpeta: 'transacciones', archivos: 1, registros: 138, unidadesSinRegistros: 0 },
      { carpeta: 'bibliografia', archivos: 1, registros: 18, unidadesSinRegistros: 0 },
    ],
    avisos: { transaccionesNoEncontradas: 0, documentosNoEncontrados: 0, registrosSinUnidad: 0 },
    ...parcial,
  };
}

/** Texto plano de todos los nodos del árbol (recorrido completo). */
function textos(nodo: unknown, salida: string[] = []): string[] {
  if (typeof nodo === 'string') salida.push(nodo);
  else if (Array.isArray(nodo)) nodo.forEach((n) => textos(n, salida));
  else if (nodo && typeof nodo === 'object') Object.values(nodo).forEach((n) => textos(n, salida));
  return salida;
}

type Tabla = { table: { body: Array<Array<{ text: string }>>; widths: unknown[] } };

const tablas = (resumen: ResumenDataset): Tabla[] =>
  (construirDocumentoReadme(resumen).content as Content[]).filter(
    (c): c is Content & Tabla => typeof c === 'object' && c !== null && 'table' in c,
  );

describe('fechaLarga', () => {
  it('escribe la fecha en UTC con mes en español', () => {
    expect(fechaLarga(new Date('2026-11-22T23:50:00Z'))).toBe('22 de noviembre de 2026, a las 23:50 UTC');
  });
  it('en el borde de medianoche UTC no depende de la zona local', () => {
    expect(fechaLarga(new Date('2026-12-01T00:00:00Z'))).toBe('1 de diciembre de 2026, a las 00:00 UTC');
    expect(fechaLarga(new Date('2026-11-30T23:59:59Z'))).toBe('30 de noviembre de 2026, a las 23:59 UTC');
  });
});

describe('construirDocumentoReadme', () => {
  it('incluye la frase con la fecha de la exportación', () => {
    const t = textos(construirDocumentoReadme(resumenCon()).content).join('\n');
    expect(t).toContain('En la exportación generada el 22 de noviembre de 2026, a las 23:50 UTC, el contenido es el siguiente:');
  });

  it('la tabla de exportación tiene 6 filas con la carpeta en la primera columna y las cifras del resumen', () => {
    const [tabla] = tablas(resumenCon());
    const cuerpo = tabla.table.body;
    expect(cuerpo).toHaveLength(7);
    expect(cuerpo[0].map((c) => c.text)).toEqual(['Carpeta', 'Archivos XML', 'Registros']);
    expect(cuerpo.slice(1).map((f) => f[0].text)).toEqual(Object.values(CARPETAS));
    expect(cuerpo[1].map((c) => c.text)).toEqual(['Manejo de caja', '9', '69']);
    expect(cuerpo[3].map((c) => c.text)).toEqual(['Corpus Christi', '18', '21']);
    expect(cuerpo[6].map((c) => c.text)).toEqual(['Bibliografía', '1', '18']);
    expect(tabla.table.widths).toEqual(['*', 'auto', 'auto']);
  });

  it('la tabla de estructuras (sección 5) tiene 6 filas y anchos explícitos', () => {
    const tabla = tablas(resumenCon())[1];
    expect(tabla.table.body).toHaveLength(7);
    expect(tabla.table.widths).toHaveLength(3);
  });

  it('recalcula las compañías sin archivo propio en dígitos, con plural', () => {
    const t = textos(construirDocumentoReadme(resumenCon()).content).join('\n');
    expect(t).toContain('10 compañías del índice no tienen registros de caja y 10 no tienen registros de remuneraciones; por ese motivo, no cuentan con un archivo propio en las carpetas respectivas.');
  });

  const sinArchivo = (caja: number, remu: number): ResumenDataset =>
    resumenCon({
      carpetas: resumenCon().carpetas.map((c) => ({
        ...c,
        unidadesSinRegistros: c.carpeta === 'caja' ? caja : c.carpeta === 'remuneraciones' ? remu : 0,
      })),
    });

  it.each([
    [0, 0, 'Todas las compañías del índice tienen registros de caja y de remuneraciones, por lo que cada una cuenta con un archivo propio en las carpetas respectivas.'],
    [0, 3, 'Todas las compañías del índice tienen registros de caja y 3 compañías no tienen registros de remuneraciones; por ese motivo, no cuentan con un archivo propio en la carpeta respectiva.'],
    [1, 0, '1 compañía del índice no tiene registros de caja y todas tienen registros de remuneraciones; por ese motivo, no cuenta con un archivo propio en la carpeta respectiva.'],
    [0, 1, 'Todas las compañías del índice tienen registros de caja y 1 compañía no tiene registros de remuneraciones; por ese motivo, no cuenta con un archivo propio en la carpeta respectiva.'],
    [1, 1, '1 compañía del índice no tiene registros de caja y 1 no tiene registros de remuneraciones; por ese motivo, no cuentan con un archivo propio en las carpetas respectivas.'],
    [3, 0, '3 compañías del índice no tienen registros de caja y todas tienen registros de remuneraciones; por ese motivo, no cuentan con un archivo propio en la carpeta respectiva.'],
    [10, 10, '10 compañías del índice no tienen registros de caja y 10 no tienen registros de remuneraciones; por ese motivo, no cuentan con un archivo propio en las carpetas respectivas.'],
  ])('compañías sin archivo propio (%i, %i): frase completa', (caja, remu, frase) => {
    const t = textos(construirDocumentoReadme(sinArchivo(caja, remu)).content).join('\n');
    expect(t).toContain(`Estas cifras corresponden a la exportación indicada. ${frase}`);
  });

  it('avisos en cero: cifras en dígitos', () => {
    const t = textos(construirDocumentoReadme(resumenCon()).content).join('\n');
    expect(t).toContain('En la exportación del 22 de noviembre de 2026 se indican 0 transacciones citadas y no encontradas, 0 documentos citados y no encontrados, y 0 registros sin compañía o sin ciudad y año.');
  });

  it('avisos distintos de cero, con singular y plural', () => {
    const r = resumenCon({ avisos: { transaccionesNoEncontradas: 1, documentosNoEncontrados: 12, registrosSinUnidad: 3 } });
    const t = textos(construirDocumentoReadme(r).content).join('\n');
    expect(t).toContain('1 transacción citada y no encontrada, 12 documentos citados y no encontrados, y 3 registros sin compañía o sin ciudad y año.');
  });

  it('conserva ł, ñ, tildes, comillas angulares y el texto de Laura', () => {
    const t = textos(construirDocumentoReadme(resumenCon()).content).join('\n');
    for (const frag of ['Skłodowska', "Ca' Foscari", '‘ñ’', '«otro - nombre del empleador - temporadas»; cada combinación', '¿Qué es PRETSO?', 'Índice de compañías', 'DOI: pendiente.', 'lauraagar.pazrescala@unive.it']) {
      expect(t).toContain(frag);
    }
    expect(t).not.toContain('dataser');
    expect(t).not.toContain('atributo o label');
    expect(t).not.toContain('[[');
  });

  it('declara A4 y la fuente Roboto', () => {
    const doc = construirDocumentoReadme(resumenCon());
    expect(doc.pageSize).toBe('A4');
    expect(doc.defaultStyle).toMatchObject({ font: 'Roboto' });
  });
});
