import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { cleanFirebaseData } from '../../utils';
import { construirIndice } from './indiceBusqueda';
import type { IndiceBusqueda } from './indiceBusqueda';

/** Todas las colecciones que alimentan el índice, para todos los roles (una coincidencia anidada sube a su caja). */
export const COLECCIONES_INDICE = [
  'manejo_de_caja', 'salarios', 'corpus_christi', 'indicadores',
  'companias', 'bibliografia', 'transacciones', 'documentos',
] as const;

export const VIGENCIA_INDICE_MS = 15 * 60 * 1000;

let promesa: Promise<IndiceBusqueda> | null = null;
let cargadoEn = 0;
let version = 0;
const suscriptores = new Set<() => void>();

async function leer(): Promise<IndiceBusqueda> {
  const datos: Record<string, unknown[]> = {};
  await Promise.all(COLECCIONES_INDICE.map(async nombre => {
    const snap = await getDocs(query(collection(db, nombre)));
    datos[nombre] = snap.docs.map(cleanFirebaseData);
  }));
  return construirIndice(datos);
}

/** Índice de sesión: una sola carga compartida, vigente 15 minutos y borrada si falla. */
export function cargarIndice(ahora: () => number = Date.now): Promise<IndiceBusqueda> {
  if (promesa && ahora() - cargadoEn < VIGENCIA_INDICE_MS) return promesa;
  cargadoEn = ahora();
  const actual = leer();
  promesa = actual;
  actual.catch(() => {
    if (promesa === actual) promesa = null;
  });
  return actual;
}

/** Borra la caché y avisa a los suscriptores (se llama tras cada escritura). */
export function invalidarIndice(): void {
  promesa = null;
  version += 1;
  for (const fn of [...suscriptores]) fn();
}

export function versionIndice(): number {
  return version;
}

export function suscribirIndice(fn: () => void): () => void {
  suscriptores.add(fn);
  return () => { suscriptores.delete(fn); };
}
