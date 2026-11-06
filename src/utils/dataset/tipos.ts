/** Tipos y constantes comunes del módulo del dataset descargable. */
export type Registro = Record<string, unknown>;

export interface DatosDataset {
  companias: Registro[];
  manejo_de_caja: Registro[];
  salarios: Registro[];
  corpus_christi: Registro[];
  transacciones: Registro[];
  documentos: Registro[];
  bibliografia: Registro[];
}

export const NOMBRE_DATASET = 'PRETSO — Precios del Teatro del Siglo de Oro';
export const VERSION_FORMATO = '1.0';
export const CODIFICACION = 'UTF-8';

export const CARPETAS = {
  caja: 'Manejo de caja',
  remuneraciones: 'Remuneraciones',
  corpus: 'Corpus Christi',
  companias: 'Índice de compañías',
  transacciones: 'Lista de transacciones',
  bibliografia: 'Bibliografía',
} as const;

export type ClaveCarpeta = keyof typeof CARPETAS;

export interface ArchivoDataset {
  carpeta: ClaveCarpeta;
  /** Nombre sin extensión. */
  nombre: string;
  contenido: string;
  unidad: string;
  registros: number;
}

/**
 * Avisos de la generación. Las referencias inexistentes se cuentan una vez por
 * referencia única (no por aparición): por eso son conjuntos de claves
 * (transacción: número canonizado; documento: clave estricta tipo:valor).
 */
export interface AvisosDataset {
  transaccionesNoEncontradas: Set<string>;
  documentosNoEncontrados: Set<string>;
  registrosSinUnidad: number;
}

export function crearAvisos(): AvisosDataset {
  return { transaccionesNoEncontradas: new Set(), documentosNoEncontrados: new Set(), registrosSinUnidad: 0 };
}

export function contarAvisos(a: AvisosDataset): {
  transaccionesNoEncontradas: number;
  documentosNoEncontrados: number;
  registrosSinUnidad: number;
} {
  return {
    transaccionesNoEncontradas: a.transaccionesNoEncontradas.size,
    documentosNoEncontrados: a.documentosNoEncontrados.size,
    registrosSinUnidad: a.registrosSinUnidad,
  };
}

export interface ResultadoCarpeta {
  archivos: ArchivoDataset[];
  avisos: AvisosDataset;
  unidadesSinRegistros: number;
}

export interface ResumenDataset {
  generadoEn: Date;
  carpetas: Array<{ carpeta: ClaveCarpeta; archivos: number; registros: number; unidadesSinRegistros: number }>;
  avisos: AvisosDataset;
}

/** Nombres de los archivos de registros sin unidad (decisión D3). */
export const SIN_UNIDAD = { companias: 'Sin compañía identificada', corpus: 'Sin ciudad o año' } as const;
