import { construirEnlaces } from './enlaces';
import { generarBibliografia, generarIndiceCompanias, generarListaTransacciones } from './listas';
import { generarCarpetaCompania, generarCarpetaCorpus } from './porUnidad';
import { generarReadme } from './readme';
import { CARPETAS, combinarAvisos, contarAvisos, type DatosDataset, type ResumenDataset, type ResultadoCarpeta } from './tipos';
import { armarZip } from './zip';

/** Nombre del ZIP con la fecha de generación en UTC (decisión D2). */
export function nombreZipDataset(d: Date): string {
  return `PRETSO_dataset_${d.toISOString().slice(0, 10)}.zip`;
}

/** Genera todos los archivos del dataset (seis carpetas y el README de la raíz) y su resumen. */
export function generarArchivosDataset(
  datos: DatosDataset,
  generadoEn: Date,
): { entradas: Array<{ ruta: string; contenido: string }>; resumen: ResumenDataset } {
  const enlaces = construirEnlaces(datos);
  const resultados: Array<[keyof typeof CARPETAS, ResultadoCarpeta]> = [
    ['caja', generarCarpetaCompania('caja', datos, enlaces, generadoEn)],
    ['remuneraciones', generarCarpetaCompania('remuneraciones', datos, enlaces, generadoEn)],
    ['corpus', generarCarpetaCorpus(datos, enlaces, generadoEn)],
    ['companias', generarIndiceCompanias(datos, generadoEn)],
    ['transacciones', generarListaTransacciones(datos, enlaces, generadoEn)],
    ['bibliografia', generarBibliografia(datos, generadoEn)],
  ];
  const entradas: Array<{ ruta: string; contenido: string }> = [];
  for (const [, r] of resultados) {
    for (const a of r.archivos) entradas.push({ ruta: `${CARPETAS[a.carpeta]}/${a.nombre}.xml`, contenido: a.contenido });
  }
  const resumen: ResumenDataset = {
    generadoEn,
    carpetas: resultados.map(([carpeta, r]) => ({
      carpeta,
      archivos: r.archivos.length,
      registros: r.archivos.reduce((s, a) => s + a.registros, 0),
      unidadesSinRegistros: r.unidadesSinRegistros,
    })),
    avisos: contarAvisos(combinarAvisos(...resultados.map(([, r]) => r.avisos))),
  };
  entradas.push({ ruta: 'README.md', contenido: generarReadme(resumen) });
  return { entradas, resumen };
}

export async function generarDatasetZip(
  datos: DatosDataset,
  generadoEn: Date,
): Promise<{ nombre: string; blob: Blob; resumen: ResumenDataset }> {
  const { entradas, resumen } = generarArchivosDataset(datos, generadoEn);
  const blob = await armarZip(entradas, generadoEn);
  return { nombre: nombreZipDataset(generadoEn), blob, resumen };
}
