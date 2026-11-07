import { canonizarReferencia } from '../referenciaCompania';
import { claveEstricta, idsDocumentos } from '../documentosTransaccion';
import { CAMPOS_DATASET } from './campos';
import { esRegistro } from './orden';
import type { AvisosDataset, DatosDataset, Registro } from './tipos';
import { atributoXml, campoXml, camposXml } from './xml';

export interface Enlaces {
  transacciones: Map<string, Registro>;
  documentos: Map<string, Registro>;
}

function definicion(coleccion: 'transacciones' | 'documentos', campo: string) {
  const def = CAMPOS_DATASET[coleccion].find((d) => d.campo === campo);
  if (!def) throw new Error(`Falta la definición del campo ${campo} en ${coleccion}`);
  return def;
}
const DEF_NUM = definicion('transacciones', 'Num');
const DEF_DOC = definicion('documentos', 'Doc');


export function construirEnlaces(datos: Pick<DatosDataset, 'transacciones' | 'documentos'>): Enlaces {
  const transacciones = new Map<string, Registro>();
  for (const t of datos.transacciones) {
    if (!esRegistro(t)) continue;
    const clave = canonizarReferencia(t['Num']);
    if (clave !== '' && !transacciones.has(clave)) transacciones.set(clave, t);
  }
  const documentos = new Map<string, Registro>();
  for (const d of datos.documentos) {
    if (!esRegistro(d)) continue;
    const clave = claveEstricta(d['Doc']);
    if (!documentos.has(clave)) documentos.set(clave, d);
  }
  return { transacciones, documentos };
}

export function transaccionXml(ref: unknown, enlaces: Enlaces, sangria: number, avisos: AvisosDataset): string {
  const canon = canonizarReferencia(ref);
  if (canon === '') return '';
  const margen = '  '.repeat(sangria);
  const tx = enlaces.transacciones.get(canon);
  if (!tx) {
    avisos.transaccionesNoEncontradas.add(canon);
    return (
      `${margen}<transaction${atributoXml('found', 'false')}>\n` +
      campoXml(DEF_NUM, canon, sangria + 1) +
      `${margen}</transaction>\n`
    );
  }
  const ids = idsDocumentos(tx);
  let salida = `${margen}<transaction>\n` + camposXml(CAMPOS_DATASET.transacciones, { ...tx, Num: canon }, sangria + 1);
  if (ids.length === 0) {
    salida += `${margen}  <documents/>\n`;
  } else {
    salida += `${margen}  <documents>\n`;
    for (const id of ids) {
      const doc = enlaces.documentos.get(claveEstricta(id));
      if (doc) {
        salida += `${margen}    <document>\n` + camposXml(CAMPOS_DATASET.documentos, doc, sangria + 3) + `${margen}    </document>\n`;
      } else {
        avisos.documentosNoEncontrados.add(claveEstricta(id));
        salida +=
          `${margen}    <document${atributoXml('found', 'false')}>\n` +
          campoXml(DEF_DOC, id, sangria + 3) +
          `${margen}    </document>\n`;
      }
    }
    salida += `${margen}  </documents>\n`;
  }
  return salida + `${margen}</transaction>\n`;
}
