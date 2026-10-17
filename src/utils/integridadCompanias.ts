import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { camposReferenciaCompania, resolverCompania, type CompaniaRef } from './referenciaCompania';

/**
 * Cuenta los documentos de una colección que referencian a la compañía, en
 * cualquiera de sus campos de referencia. Usa la misma regla que la app para
 * interpretar una referencia (`resolverCompania`: número de registro, incluso
 * en texto como "7.0", o sigla sin distinguir mayúsculas, tildes ni espacios).
 * Cada documento se cuenta una sola vez. Si la lectura falla, el error se
 * propaga (fallo cerrado: quien llama no debe asumir que no hay referencias).
 */
export async function contarReferenciasACompania(coleccion: string, compania: CompaniaRef): Promise<number> {
  const campos = camposReferenciaCompania(coleccion);
  const snap = await getDocs(collection(db, coleccion));
  let total = 0;
  for (const d of snap.docs) {
    const datos = d.data() as Record<string, unknown>;
    if (campos.some(campo => resolverCompania(datos[campo], [compania]) !== null)) total++;
  }
  return total;
}
