import { canonizarReferencia } from '../referenciaCompania';
import { CAMPOS_DATASET } from './campos';
import { esRegistro, idsDocumentos, transaccionXml, type Enlaces } from './enlaces';
import { ordenarPorNumero } from './porUnidad';
import { CARPETAS, crearAvisos, type AvisosDataset, type ClaveCarpeta, type DatosDataset, type Registro, type ResultadoCarpeta } from './tipos';
import { atributoXml, cabeceraXml, campoXml, CIERRE_XML, camposXml } from './xml';

/** Número para ordenar; vacío, nulo o no numérico da NaN (va al final). */
function numeroOrdenable(v: unknown): number {
  return Number(canonizarReferencia(v) || Number.NaN);
}

function texto(v: unknown): string {
  return typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
}

/** Arma el resultado de una carpeta con un único archivo. */
function resultadoUnico(
  carpeta: ClaveCarpeta,
  unidad: string,
  registros: number,
  generadoEn: Date,
  raiz: string,
  cuerpo: string,
  avisos = crearAvisos(),
): ResultadoCarpeta {
  const contenido =
    cabeceraXml({ seccion: CARPETAS[carpeta], unidad, registros, generadoEn }) +
    (cuerpo === '' ? `  <${raiz}/>\n` : `  <${raiz}>\n${cuerpo}  </${raiz}>\n`) +
    CIERRE_XML;
  return {
    archivos: [{ carpeta, nombre: CARPETAS[carpeta], contenido, unidad, registros }],
    avisos,
    unidadesSinRegistros: 0,
  };
}

export function generarIndiceCompanias(datos: DatosDataset, generadoEn: Date): ResultadoCarpeta {
  const companias = ordenarPorNumero(datos.companias.filter(esRegistro), (c) => numeroOrdenable(c['Indicador de registro']));
  const cuerpo = companias
    .map((c) => `    <company>\n${camposXml(CAMPOS_DATASET.companias, c, 3)}    </company>\n`)
    .join('');
  return resultadoUnico('companias', 'Todas las compañías', companias.length, generadoEn, 'companies', cuerpo);
}

const DEF_DOC = CAMPOS_DATASET.documentos.find((d) => d.campo === 'Doc');
const claveEstricta = (v: unknown) => `${typeof v}:${String(v)}`;

/**
 * Transacción cuyo número está vacío o repetido: no entra en los enlaces, pero
 * se conserva armada desde su propio registro, con `number_status`.
 */
function transaccionAparteXml(t: Registro, estado: 'duplicate' | 'missing', canon: string, enlaces: Enlaces, avisos: AvisosDataset): string {
  let salida = `    <transaction${atributoXml('number_status', estado)}>\n` + camposXml(CAMPOS_DATASET.transacciones, { ...t, Num: canon }, 3);
  const ids = idsDocumentos(t);
  if (ids.length === 0) return salida + '      <documents/>\n    </transaction>\n';
  salida += '      <documents>\n';
  for (const id of ids) {
    const doc = enlaces.documentos.get(claveEstricta(id));
    if (doc) {
      salida += '        <document>\n' + camposXml(CAMPOS_DATASET.documentos, doc, 5) + '        </document>\n';
    } else {
      avisos.documentosNoEncontrados.add(claveEstricta(id));
      salida += `        <document${atributoXml('found', 'false')}>\n` + (DEF_DOC ? campoXml(DEF_DOC, id, 5) : '') + '        </document>\n';
    }
  }
  return salida + '      </documents>\n    </transaction>\n';
}

export function generarListaTransacciones(datos: DatosDataset, enlaces: Enlaces, generadoEn: Date): ResultadoCarpeta {
  const avisos = crearAvisos();
  const vistos = new Set<string>();
  const normales: Registro[] = [];
  const aparte: Array<{ t: Registro; estado: 'duplicate' | 'missing'; canon: string }> = [];
  for (const t of datos.transacciones.filter(esRegistro)) {
    const canon = canonizarReferencia(t['Num']);
    if (canon === '') aparte.push({ t, estado: 'missing', canon });
    else if (vistos.has(canon)) aparte.push({ t, estado: 'duplicate', canon });
    else {
      vistos.add(canon);
      normales.push(t);
    }
  }
  const ordenadas = ordenarPorNumero(normales, (t) => numeroOrdenable(t['Num']));
  const cuerpo =
    ordenadas.map((t) => transaccionXml(t['Num'], enlaces, 2, avisos)).join('') +
    aparte.map((x) => transaccionAparteXml(x.t, x.estado, x.canon, enlaces, avisos)).join('');
  return resultadoUnico('transacciones', 'Todas las transacciones', ordenadas.length + aparte.length, generadoEn, 'transactions', cuerpo, avisos);
}

export function generarBibliografia(datos: DatosDataset, generadoEn: Date): ResultadoCarpeta {
  const entradas = datos.bibliografia
    .filter(esRegistro)
    .map((b, indice) => ({ b, indice }))
    .sort((x, y) => {
      const ax = texto(x.b['Autores']);
      const ay = texto(y.b['Autores']);
      // Sin autores, al final.
      if ((ax === '') !== (ay === '')) return ax === '' ? 1 : -1;
      return ax.localeCompare(ay, 'es') || x.indice - y.indice;
    })
    .map((x) => x.b);
  const cuerpo = entradas
    .map((b) => `    <bibliography>\n${camposXml(CAMPOS_DATASET.bibliografia, b, 3)}    </bibliography>\n`)
    .join('');
  return resultadoUnico('bibliografia', 'Toda la bibliografía', entradas.length, generadoEn, 'bibliographies', cuerpo);
}
