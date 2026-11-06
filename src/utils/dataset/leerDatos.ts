import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../firebase';
import { cleanFirebaseData } from '../../utils';
import type { DatosDataset, Registro } from './tipos';

/** Únicas colecciones que lee el dataset: nunca `logs`, `users` ni `indicadores`. */
export const COLECCIONES_DATASET = [
  'companias',
  'manejo_de_caja',
  'salarios',
  'corpus_christi',
  'transacciones',
  'documentos',
  'bibliografia',
] as const;

/** Lee las siete colecciones en paralelo; `'x'` pasa a vacío igual que en la interfaz. */
export async function leerDatosDataset(): Promise<DatosDataset> {
  const lecturas = await Promise.all(
    COLECCIONES_DATASET.map(async (nombre) => {
      const snap = await getDocs(query(collection(db, nombre)));
      return snap.docs.map((d) => cleanFirebaseData(d) as Registro);
    }),
  );
  const [companias, manejo_de_caja, salarios, corpus_christi, transacciones, documentos, bibliografia] = lecturas;
  return { companias, manejo_de_caja, salarios, corpus_christi, transacciones, documentos, bibliografia };
}
