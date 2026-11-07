import { canonizarReferencia } from '../referenciaCompania';
import { CAMPOS_DATASET } from './campos';
import { esRegistro } from './orden';
import type { AvisosDataset, DatosDataset, Registro } from './tipos';
import { atributoXml, campoXml, camposXml } from './xml';

export interface Enlaces {
  transacciones: Map<string, Registro>;
  documentos: Map<string, Registro>;
}

// Mismo criterio que indiceBusqueda.ts (allí no se exportan): comparación estricta de tipo y valor.
const claveEstricta = (v: unknown) => `${typeof v}:${String(v)}`;
const CAMPOS_DOC = Array.from({ length: 10 }, (_, i) => `Doc${i + 1}`);

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

/** Doc1..Doc10 en orden, sin repetidos; salta lo que no es texto ni número, `''` y `0`. */
export function idsDocumentos(tx: Registro): Array<string | number> {
  const ids: Array<string | number> = [];
  const vistos = new Set<string>();
  for (const campo of CAMPOS_DOC) {
    const id = tx[campo];
    if ((typeof id !== 'string' && typeof id !== 'number') || id === '' || id === 0) continue;
    const clave = claveEstricta(id);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    ids.push(id);
  }
  return ids;
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
