import { CAMPOS_DOC } from '../documentosTransaccion';
import { textoVisibleCompania, canonizarReferencia, resolverCompania, siglaParaExportar, type CompaniaRef } from '../referenciaCompania';

export interface CampoBuscable {
  campo: string;
  /** Campo de años (número, rango o «Activa en AAAA»). */
  anio?: boolean;
  /** Campo que guarda una referencia a compañía: se busca por la sigla o el nombre. */
  compania?: boolean;
}

/** Unidad de navegación de una sección (maestro → detalle) y sus parámetros de URL. */
export interface UnidadBusqueda {
  nombre: string;
  parametros: Record<string, string>;
}

export interface SeccionBuscable {
  coleccion: string;
  /** Nombre visible de la sección. */
  nombre: string;
  campos: CampoBuscable[];
  /**
   * Campos de la compañía resuelta desde «Sigla Compañía» que el listado de la sección también
   * muestra: se indexan en cada registro, de modo que la unidad (la compañía) coincide por ellos.
   */
  camposCompania?: CampoBuscable[];
  /** Solo se lista como sección a administradores (Transacciones y Documentos). */
  soloAdmin?: boolean;
  /** Unidad (compañía, ciudad y año, categoría) a la que pertenece un registro; null si no tiene. */
  unidad: (registro: Record<string, unknown>, companias: CompaniaRef[]) => UnidadBusqueda | null;
}

const sinUnidad = () => null;

function unidadCompania(registro: Record<string, unknown>, companias: CompaniaRef[]): UnidadBusqueda | null {
  const valor = registro['Sigla Compañía'];
  const ref = canonizarReferencia(valor);
  if (ref === '') return null;
  const compania = resolverCompania(valor, companias);
  const nombre = compania ? textoVisibleCompania(compania) : siglaParaExportar(valor, companias);
  return { nombre, parametros: { compania: ref } };
}

const comp = (campo: string): CampoBuscable => ({ campo, compania: true });
const anio = (campo: string): CampoBuscable => ({ campo, anio: true });
const txt = (campo: string): CampoBuscable => ({ campo });
const CAMPOS_COMPANIA_LISTADO: CampoBuscable[] = [txt('Nombre Compañía'), txt('Autores'), txt('Ámbito'), anio('Temporadas teatrales')];

/**
 * Campos visibles de cada colección. Nunca se recorre `Object.entries` de un
 * registro: lo que no está aquí (número de registro, «Transacción», campos
 * retirados) no se busca.
 */
export const MAPA_SECCIONES: readonly SeccionBuscable[] = [
  {
    coleccion: 'manejo_de_caja',
    nombre: 'Manejo de caja',
    campos: [comp('Sigla Compañía'), anio('Año'), txt('Ciudad'), txt('Ingresos'), txt('Egresos'), txt('Otros bienes de la compañía')],
    camposCompania: CAMPOS_COMPANIA_LISTADO,
    unidad: unidadCompania,
  },
  {
    coleccion: 'salarios',
    nombre: 'Remuneraciones',
    campos: [
      comp('Sigla Compañía'), anio('Año'), txt('Ciudad'), txt('Beneficiario '), txt('Encargo'),
      txt('Monto a pagar'), txt('Ración diaria'), txt('Pago por representación'),
    ],
    camposCompania: CAMPOS_COMPANIA_LISTADO,
    unidad: unidadCompania,
  },
  {
    coleccion: 'corpus_christi',
    nombre: 'Corpus Christi',
    campos: [
      txt('Ciudad'), anio('Año'), txt('Encargado '), txt('Encargo'), txt('Monto a pagar'), txt('Fondos'),
      comp('Compañía'), ...Array.from({ length: 9 }, (_, i) => comp(`Compañía${i + 2}`)), comp('Cmp'), comp('Cmp2'),
    ],
    unidad: r => {
      const ciudad = String(r['Ciudad'] ?? '').trim();
      const a = String(r['Año'] ?? '').trim();
      if (ciudad === '' || a === '') return null;
      return { nombre: `${ciudad} ${a}`, parametros: { ciudad, anio: a } };
    },
  },
  {
    coleccion: 'indicadores',
    nombre: 'Identificación de indicadores',
    campos: [txt('Ciudad'), anio('Años'), txt('Concepto'), txt('Monto'), txt('Nota'), txt('Categorías'), comp('Sigla Compañía')],
    unidad: r => {
      const categoria = String(r['Categorías'] ?? '').trim();
      return categoria === '' ? null : { nombre: categoria, parametros: { categoria } };
    },
  },
  {
    coleccion: 'companias',
    nombre: 'Índice de compañías',
    campos: [txt('Sigla Compañía'), txt('Nombre Compañía'), txt('Autores'), anio('Temporadas teatrales'), txt('Índice de compañías'), txt('Ámbito')],
    unidad: sinUnidad,
  },
  {
    coleccion: 'bibliografia',
    nombre: 'Bibliografía',
    campos: [txt('Autores'), txt('Referencias bibliográficas')],
    unidad: sinUnidad,
  },
  {
    coleccion: 'transacciones',
    nombre: 'Transacciones',
    soloAdmin: true,
    campos: [
      txt('Num'), txt('Noticia'), txt('Fuentes para la generación del dato'),
      ...CAMPOS_DOC.map((c) => txt(c)),
    ],
    unidad: sinUnidad,
  },
  {
    coleccion: 'documentos',
    nombre: 'Documentos',
    soloAdmin: true,
    campos: [txt('Doc'), txt('Documento')],
    unidad: sinUnidad,
  },
];

export function seccionDe(coleccion: string): SeccionBuscable | undefined {
  return MAPA_SECCIONES.find(s => s.coleccion === coleccion);
}
