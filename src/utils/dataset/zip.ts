import JSZip from 'jszip';
import { asignarNombresUnicos } from './nombres';

/**
 * Arma el ZIP del dataset. Las rutas que solo difieren en mayúsculas o tildes
 * se consideran duplicadas (misma clave que `asignarNombresUnicos`).
 */
export async function armarZip(
  entradas: Array<{ ruta: string; contenido: string }>,
  fecha: Date,
): Promise<Uint8Array> {
  const unicas = asignarNombresUnicos(entradas.map((e) => e.ruta));
  const repetida = unicas.findIndex((nombre, i) => nombre !== entradas[i].ruta);
  if (repetida !== -1) {
    throw new Error(`Ruta duplicada en el dataset: ${entradas[repetida].ruta}`);
  }
  const zip = new JSZip();
  for (const { ruta, contenido } of entradas) {
    zip.file(ruta, contenido, { date: fecha });
  }
  return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}
