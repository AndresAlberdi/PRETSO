import { collection, getDocs, query, where, writeBatch, doc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../firebase";
import { normalizarTexto } from "./filtrarRegistros";
import { invalidarIndice } from "./busquedaGuia/cargaIndice";

export const MAX_LONGITUD_CATEGORIA = 200;
// Cada documento cuesta 2 escrituras (indicador y bitácora); el límite de Firestore es 500 por lote.
const TAMANO_LOTE = 200;
const CAMPO = "Categorías";

export type ErrorNombreCategoria = "vacio" | "sin_cambio" | "largo" | "duplicado";

/** Devuelve el motivo por el que el nombre no sirve, o null si es válido. */
export function validarNuevoNombreCategoria(
  nuevo: string,
  actual: string,
  existentes: readonly string[],
): ErrorNombreCategoria | null {
  const limpio = nuevo.trim();
  if (limpio === "") return "vacio";
  if (limpio.length > MAX_LONGITUD_CATEGORIA) return "largo";
  if (limpio === actual) return "sin_cambio";
  const normalizado = normalizarTexto(limpio);
  const hayDuplicado = existentes.some((c) => c !== actual && normalizarTexto(c) === normalizado);
  if (hayDuplicado) return "duplicado";
  return null;
}

export class RenombreParcialError extends Error {
  readonly code = "RENOMBRE_PARCIAL";
  /** Identificadores de los documentos que sí se actualizaron antes del fallo. */
  readonly actualizados: string[];
  constructor(actualizados: string[], causa: unknown) {
    super("RENOMBRE_PARCIAL");
    this.name = "RenombreParcialError";
    this.actualizados = actualizados;
    this.cause = causa;
  }
}

/**
 * Cambia la categoría de todos los indicadores que la tienen. Devuelve la cantidad actualizada.
 * La entrada de bitácora va en el mismo lote que el cambio, de modo que ambos se escriben o ninguno.
 */
export async function renombrarCategoria(anterior: string, nuevo: string): Promise<number> {
  const nombre = nuevo.trim();
  const snap = await getDocs(query(collection(db, "indicadores"), where(CAMPO, "==", anterior)));
  const ids = snap.docs.map((d) => d.id);
  const actualizados: string[] = [];
  for (let i = 0; i < ids.length; i += TAMANO_LOTE) {
    const grupo = ids.slice(i, i + TAMANO_LOTE);
    try {
      const lote = writeBatch(db);
      for (const id of grupo) {
        lote.update(doc(db, "indicadores", id), { [CAMPO]: nombre });
        lote.set(doc(collection(db, "logs")), {
          action: "EDIT",
          collection: "indicadores",
          recordId: id,
          user: auth.currentUser?.email ?? "desconocido",
          timestamp: serverTimestamp(),
          details: { [CAMPO]: nombre, categoriaAnterior: anterior },
        });
      }
      await lote.commit();
      // Las escrituras no pasan por logAction: se descarta aquí el índice de búsqueda en caché, también si luego falla un lote.
      invalidarIndice();
    } catch (error) {
      // Si no se confirmó ningún lote, no hay cambio parcial: se informa el error tal cual.
      if (actualizados.length === 0) throw error;
      throw new RenombreParcialError([...actualizados], error);
    }
    actualizados.push(...grupo);
  }
  return actualizados.length;
}
