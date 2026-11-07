import { validarTermino } from './termino';
import { buscarTramosPreparado, coincideNormalizado, type Tramo } from './coincidencias';
import { MAPA_SECCIONES, type SeccionBuscable, type UnidadBusqueda } from './mapaSecciones';
import { normalizarTexto } from '../filtrarRegistros';
import { esCampoRetirado } from '../camposRetirados';
import { claveEstricta, idsDocumentos } from '../documentosTransaccion';
import { textosCompaniaBuscables } from './textosCompania';
import { canonizarReferencia, resolverCompania, type CompaniaRef } from '../referenciaCompania';

export type Registro = Record<string, unknown>;

export interface CampoIndexado {
  campo: string;
  texto: string;
  /** Texto normalizado, calculado una sola vez al construir el índice. */
  normal: string;
  anio: boolean;
}

function campoIndexado(campo: string, texto: string, anio: boolean): CampoIndexado {
  return { campo, texto, normal: normalizarTexto(texto), anio };
}

/** Textos de la transacción enlazada y de los documentos que esta enlaza (Doc1..Doc10). */
export interface NodoEnlace {
  campos: CampoIndexado[];
}

export interface EnlaceIndexado {
  /** Nodo compartido por todos los registros que enlazan la misma transacción. */
  transaccion: NodoEnlace | null;
  documentos: Array<{ id: string | number; nodo: NodoEnlace }>;
}

export interface EntradaIndice {
  coleccion: string;
  registro: Registro;
  campos: CampoIndexado[];
  unidad: UnidadBusqueda | null;
  enlace: EnlaceIndexado;
}

/** Colecciones cuyos registros enlazan una transacción por el campo «Transacción». */
const COLECCIONES_CON_TRANSACCION = ['manejo_de_caja', 'salarios', 'corpus_christi', 'indicadores'];
const CAMPOS_TRANSACCION = ['Noticia', 'Fuentes para la generación del dato'];

export interface CoincidenciasRegistro {
  campos: CoincidenciaCampo[];
  /** El término está en la transacción enlazada (Noticia o Fuentes). */
  transaccion: boolean;
  /** Valores de Doc N (ids de documento) enlazados cuyo texto contiene el término. */
  documentos: Array<string | number>;
}

export interface IndiceBusqueda {
  entradas: EntradaIndice[];
  porColeccion: Map<string, EntradaIndice[]>;
  porRegistro: Map<Registro, EntradaIndice>;
}

export interface CoincidenciaCampo {
  campo: string;
  tramos: Tramo[];
}

export interface ResultadoRegistro {
  registro: Registro;
  unidad: UnidadBusqueda | null;
  coincidencias: CoincidenciaCampo[];
  transaccion: boolean;
  documentos: Array<string | number>;
}

export interface ResultadoSeccion {
  coleccion: string;
  nombre: string;
  registros: ResultadoRegistro[];
  /** Unidades distintas con coincidencia (vacío en secciones sin unidad). */
  unidades: UnidadBusqueda[];
}

export interface OpcionesBuscarEnIndice {
  /** Lista también las secciones solo para administradores. Por omisión no. */
  incluirAdmin?: boolean;
  /** Restringe la búsqueda a estas colecciones (p. ej. la sección abierta). */
  colecciones?: string[];
}

function esRegistro(valor: unknown): valor is Registro {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function camposIndexados(
  seccion: SeccionBuscable,
  registro: Registro,
  companias: CompaniaRef[],
  cache: Map<string, string>,
): CampoIndexado[] {
  const salida: CampoIndexado[] = [];
  for (const def of seccion.campos) {
    if (esCampoRetirado(seccion.coleccion, def.campo)) continue;
    const valor = registro[def.campo];
    if (valor === null || valor === undefined || valor === '') continue;
    if (def.compania) {
      // Se busca por lo que se ve (sigla o nombre), nunca por el número de registro.
      const textos = textosCompaniaBuscables({ [def.campo]: valor }, seccion.coleccion, companias, cache);
      for (const texto of textos) salida.push(campoIndexado(def.campo, texto, false));
    } else if (typeof valor === 'string' || typeof valor === 'number') {
      salida.push(campoIndexado(def.campo, String(valor), def.anio === true));
    }
  }
  if (seccion.camposCompania) {
    const compania = resolverCompania(registro['Sigla Compañía'], companias);
    for (const def of seccion.camposCompania) {
      if (!compania || esCampoRetirado('companias', def.campo)) continue;
      const valor = compania[def.campo];
      if (typeof valor === 'string' || typeof valor === 'number') {
        if (valor !== '') salida.push(campoIndexado(def.campo, String(valor), def.anio === true));
      }
    }
  }
  return salida;
}

function mapaPorClave(registros: readonly unknown[] | undefined, campo: string): Map<string, Registro> {
  const mapa = new Map<string, Registro>();
  for (const r of registros ?? []) {
    if (!esRegistro(r)) continue;
    const clave = canonizarReferencia(r[campo]);
    if (clave !== '' && !mapa.has(clave)) mapa.set(clave, r);
  }
  return mapa;
}

function camposDeTexto(registro: Registro, nombres: readonly string[]): CampoIndexado[] {
  const salida: CampoIndexado[] = [];
  for (const campo of nombres) {
    const v = registro[campo];
    if (typeof v === 'string' || typeof v === 'number') {
      if (v !== '') salida.push(campoIndexado(campo, String(v), false));
    }
  }
  return salida;
}

const ENLACE_VACIO: EnlaceIndexado = { transaccion: null, documentos: [] };

interface Mapas {
  transacciones: Map<string, Registro>;
  /** Clave estricta (tipo y valor), como el `where('Doc','in',…)` de TransactionModal. */
  documentos: Map<string, Registro>;
  nodosTransaccion: Map<Registro, NodoEnlace>;
  nodosDocumento: Map<Registro, NodoEnlace>;
}


function nodoDe(cache: Map<Registro, NodoEnlace>, r: Registro, nombres: readonly string[]): NodoEnlace {
  let nodo = cache.get(r);
  if (!nodo) {
    nodo = { campos: camposDeTexto(r, nombres) };
    cache.set(r, nodo);
  }
  return nodo;
}

/**
 * Un enlace roto (Num o Doc inexistente) no aporta textos. La transacción se
 * busca por número canonizado (admite 7 y "7.0"). Los documentos se buscan como
 * TransactionModal: se toman los Doc1..Doc10 con valor y se comparan con `Doc`
 * de forma estricta (tipo y valor); un mismo documento repetido cuenta una vez.
 */
function enlazar(coleccion: string, registro: Registro, m: Mapas): EnlaceIndexado {
  if (!COLECCIONES_CON_TRANSACCION.includes(coleccion)) return ENLACE_VACIO;
  const ref = canonizarReferencia(registro['Transacción']);
  const transaccion = ref === '' ? undefined : m.transacciones.get(ref);
  if (!transaccion) return ENLACE_VACIO;
  const docs: EnlaceIndexado['documentos'] = [];
  for (const id of idsDocumentos(transaccion)) {
    const doc = m.documentos.get(claveEstricta(id));
    if (doc) docs.push({ id, nodo: nodoDe(m.nodosDocumento, doc, ['Documento']) });
  }
  return { transaccion: nodoDe(m.nodosTransaccion, transaccion, CAMPOS_TRANSACCION), documentos: docs };
}

/**
 * Prepara una vez los textos visibles (y su forma normalizada) de todos los
 * registros. Los registros que no son objetos se ignoran; los campos ausentes
 * o nulos no fallan.
 */
export function construirIndice(datos: Record<string, readonly unknown[] | undefined>): IndiceBusqueda {
  const companias = (datos.companias ?? []).filter(esRegistro) as CompaniaRef[];
  const cache = new Map<string, string>();
  const documentos = new Map<string, Registro>();
  for (const d of datos.documentos ?? []) {
    if (!esRegistro(d)) continue;
    const clave = claveEstricta(d['Doc']);
    if (!documentos.has(clave)) documentos.set(clave, d);
  }
  const mapas: Mapas = {
    transacciones: mapaPorClave(datos.transacciones, 'Num'),
    documentos,
    nodosTransaccion: new Map(),
    nodosDocumento: new Map(),
  };
  const entradas: EntradaIndice[] = [];
  const porColeccion = new Map<string, EntradaIndice[]>();
  const porRegistro = new Map<Registro, EntradaIndice>();
  for (const seccion of MAPA_SECCIONES) {
    const lista: EntradaIndice[] = [];
    porColeccion.set(seccion.coleccion, lista);
    for (const registro of datos[seccion.coleccion] ?? []) {
      if (!esRegistro(registro)) continue;
      const entrada: EntradaIndice = {
        coleccion: seccion.coleccion,
        registro,
        campos: camposIndexados(seccion, registro, companias, cache),
        unidad: seccion.unidad(registro, companias),
        enlace: enlazar(seccion.coleccion, registro, mapas),
      };
      entradas.push(entrada);
      lista.push(entrada);
      porRegistro.set(registro, entrada);
    }
  }
  return { entradas, porColeccion, porRegistro };
}

function campoCoincide(c: CampoIndexado, consulta: string): boolean {
  return coincideNormalizado(c.texto, c.normal, consulta, c.anio);
}

function coincidenciasDeCampos(campos: readonly CampoIndexado[], consulta: string): CoincidenciaCampo[] {
  const salida: CoincidenciaCampo[] = [];
  for (const c of campos) {
    if (!campoCoincide(c, consulta)) continue;
    const tramos = buscarTramosPreparado(c.texto, c.normal, consulta, c.anio);
    if (tramos.length > 0) salida.push({ campo: c.campo, tramos });
  }
  return salida;
}

/** Memoria de una búsqueda: resultado por nodo de transacción o documento. */
type Memoria = Map<NodoEnlace, boolean>;

function nodoCoincide(nodo: NodoEnlace, consulta: string, memoria: Memoria): boolean {
  let r = memoria.get(nodo);
  if (r === undefined) {
    r = nodo.campos.some(c => campoCoincide(c, consulta));
    memoria.set(nodo, r);
  }
  return r;
}

function coincidenciasDeEntrada(e: EntradaIndice, consulta: string, memoria: Memoria): CoincidenciasRegistro {
  return {
    campos: coincidenciasDeCampos(e.campos, consulta),
    transaccion: e.enlace.transaccion !== null && nodoCoincide(e.enlace.transaccion, consulta, memoria),
    documentos: e.enlace.documentos.filter(d => nodoCoincide(d.nodo, consulta, memoria)).map(d => d.id),
  };
}

const SIN_COINCIDENCIAS: CoincidenciasRegistro = { campos: [], transaccion: false, documentos: [] };

/**
 * Campos, transacción enlazada y documentos enlazados en los que aparece el
 * término, para un registro ya indexado (se identifica por el propio objeto
 * que se pasó a `construirIndice`). No reconstruye nada.
 */
export function coincidenciasRegistro(indice: IndiceBusqueda, registro: unknown, termino: string): CoincidenciasRegistro {
  const valido = validarTermino(termino);
  const entrada = esRegistro(registro) ? indice.porRegistro.get(registro) : undefined;
  if (!valido.ok || !entrada) return SIN_COINCIDENCIAS;
  return coincidenciasDeEntrada(entrada, valido.termino, new Map());
}

/**
 * Secciones, registros y unidades con coincidencias, en el orden de
 * `MAPA_SECCIONES`. Un registro también coincide por su transacción o sus
 * documentos enlazados, para todos los roles; Transacciones y Documentos solo
 * se listan como sección con `incluirAdmin`.
 */
export function buscarEnIndice(
  indice: IndiceBusqueda,
  termino: string,
  opciones: OpcionesBuscarEnIndice = {},
): ResultadoSeccion[] {
  const resultado: ResultadoSeccion[] = [];
  const valido = validarTermino(termino);
  if (!valido.ok) return resultado;
  const consulta = valido.termino;
  const memoria: Memoria = new Map();
  for (const seccion of MAPA_SECCIONES) {
    if (seccion.soloAdmin && !opciones.incluirAdmin) continue;
    if (opciones.colecciones && !opciones.colecciones.includes(seccion.coleccion)) continue;
    const registros: ResultadoRegistro[] = [];
    const unidades = new Map<string, UnidadBusqueda>();
    for (const e of indice.porColeccion.get(seccion.coleccion) ?? []) {
      const c = coincidenciasDeEntrada(e, consulta, memoria);
      if (c.campos.length === 0 && !c.transaccion && c.documentos.length === 0) continue;
      registros.push({ registro: e.registro, unidad: e.unidad, coincidencias: c.campos, transaccion: c.transaccion, documentos: c.documentos });
      if (e.unidad) unidades.set(JSON.stringify(e.unidad.parametros), e.unidad);
    }
    if (registros.length > 0) {
      resultado.push({ coleccion: seccion.coleccion, nombre: seccion.nombre, registros, unidades: [...unidades.values()] });
    }
  }
  return resultado;
}
