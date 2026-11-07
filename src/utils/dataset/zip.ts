import JSZip from 'jszip';
import { asignarNombresUnicos } from './nombres';

/**
 * Arma el ZIP del dataset. Las rutas que solo difieren en mayúsculas o tildes
 * se consideran duplicadas (misma clave que `asignarNombresUnicos`).
 */
export async function armarZip(
  entradas: Array<{ ruta: string; contenido: string }>,
  fecha: Date,
): Promise<Blob> {
  const unicas = asignarNombresUnicos(entradas.map((e) => e.ruta));
  const repetida = unicas.findIndex((nombre, i) => nombre !== entradas[i].ruta);
  if (repetida !== -1) {
    throw new Error(`Ruta duplicada en el dataset: ${entradas[repetida].ruta}`);
  }
  const zip = new JSZip();
  // Las carpetas se crean a mano para que lleven la fecha de generación y no la hora actual.
  const carpetas = new Set<string>();
  for (const { ruta } of entradas) {
    const partes = ruta.split('/').slice(0, -1);
    for (let i = 1; i <= partes.length; i++) carpetas.add(`${partes.slice(0, i).join('/')}/`);
  }
  for (const carpeta of [...carpetas].sort()) zip.file(carpeta, null, { dir: true, date: fecha });
  for (const { ruta, contenido } of entradas) {
    zip.file(ruta, contenido, { date: fecha, createFolders: false });
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
