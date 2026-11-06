import { canonizarReferencia } from '../referenciaCompania';
import { CAMPOS_DATASET } from './campos';
import { transaccionXml, type Enlaces } from './enlaces';
import { CARPETAS, crearAvisos, type ClaveCarpeta, type DatosDataset, type Registro, type ResultadoCarpeta } from './tipos';
import { cabeceraXml, CIERRE_XML, camposXml } from './xml';

const esRegistro = (v: unknown): v is Registro => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Orden estable por número; los valores no numéricos (NaN) van al final. */
function ordenarPorNumero<T>(items: readonly T[], clave: (item: T) => number): T[] {
  return items
    .map((item, indice) => ({ item, indice, n: clave(item) }))
    .sort((a, b) => {
      const aNan = Number.isNaN(a.n);
      const bNan = Number.isNaN(b.n);
      if (aNan !== bNan) return aNan ? 1 : -1;
      if (!aNan && a.n !== b.n) return a.n - b.n;
      return a.indice - b.indice;
    })
    .map((x) => x.item);
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
  const companias = ordenarPorNumero(datos.companias.filter(esRegistro), (c) => Number(c['Indicador de registro']));
  const cuerpo = companias
    .map((c) => `    <company>\n${camposXml(CAMPOS_DATASET.companias, c, 3)}    </company>\n`)
    .join('');
  return resultadoUnico('companias', 'Todas las compañías', companias.length, generadoEn, 'companies', cuerpo);
}

export function generarListaTransacciones(datos: DatosDataset, enlaces: Enlaces, generadoEn: Date): ResultadoCarpeta {
  const avisos = crearAvisos();
  // Una sola vez por número canonizado (en los enlaces gana la primera) y sin referencias vacías.
  const vistos = new Set<string>();
  const unicas = datos.transacciones.filter(esRegistro).filter((t) => {
    const canon = canonizarReferencia(t['Num']);
    if (canon === '' || vistos.has(canon)) return false;
    vistos.add(canon);
    return true;
  });
  const ordenadas = ordenarPorNumero(unicas, (t) => Number(canonizarReferencia(t['Num'])));
  const cuerpo = ordenadas.map((t) => transaccionXml(t['Num'], enlaces, 2, avisos)).join('');
  return resultadoUnico('transacciones', 'Todas las transacciones', ordenadas.length, generadoEn, 'transactions', cuerpo, avisos);
}

export function generarBibliografia(datos: DatosDataset, generadoEn: Date): ResultadoCarpeta {
  const entradas = datos.bibliografia
    .filter(esRegistro)
    .map((b, indice) => ({ b, indice }))
    .sort((x, y) => texto(x.b['Autores']).localeCompare(texto(y.b['Autores']), 'es') || x.indice - y.indice)
    .map((x) => x.b);
  const cuerpo = entradas
    .map((b) => `    <bibliography>\n${camposXml(CAMPOS_DATASET.bibliografia, b, 3)}    </bibliography>\n`)
    .join('');
  return resultadoUnico('bibliografia', 'Toda la bibliografía', entradas.length, generadoEn, 'bibliographies', cuerpo);
}
