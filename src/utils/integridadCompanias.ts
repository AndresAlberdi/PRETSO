import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import { camposReferenciaCompania, valoresDeBusquedaReferencia, type CompaniaRef } from './referenciaCompania';

/**
 * Cuenta los documentos de una colección que referencian a la compañía, en
 * cualquiera de sus campos de referencia, por número de registro y, para tolerar
 * datos heredados, por la forma de texto del número y por la sigla. Cada
 * documento se cuenta una sola vez.
 */
export async function contarReferenciasACompania(coleccion: string, compania: CompaniaRef): Promise<number> {
  const campos = camposReferenciaCompania(coleccion);
  const valores = valoresDeBusquedaReferencia(compania);
  const consultas = campos.flatMap(campo => valores.map(valor => (
    getDocs(query(collection(db, coleccion), where(campo, '==', valor)))
  )));
  const resultados = await Promise.all(consultas);
  const ids = new Set<string>();
  for (const snap of resultados) for (const d of snap.docs) ids.add(d.id);
  return ids.size;
}
