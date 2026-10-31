import { camposReferenciaCompania, esCampoCompaniaCorpus, siglaParaExportar, type CompaniaRef } from './referenciaCompania';
import { etiquetaCampo } from './etiquetas';

export const CAMPOS_OCULTOS_RESULTADO: readonly string[] = ['id', 'Indicador de registro'];
export const MAX_CAMPOS_RESULTADO = 3;

/**
 * Texto de un resultado de /buscar: los primeros campos con valor, con la
 * etiqueta visible («Nro.»), la sigla en lugar del número de compañía y sin el
 * número de registro.
 */
export function textoResultadoBusqueda(
  registro: Record<string, unknown>,
  coleccion: string,
  companias: CompaniaRef[],
): string {
  const refs = camposReferenciaCompania(coleccion);
  const esReferencia = (k: string) =>
    coleccion === 'corpus_christi' ? esCampoCompaniaCorpus(k) : refs.includes(k);
  const vals = Object.entries(registro)
    .filter(([k, v]) => !CAMPOS_OCULTOS_RESULTADO.includes(k) && v)
    .map(([k, v]): [string, string] => [k, esReferencia(k) ? siglaParaExportar(v, companias) : String(v)])
    .filter(([, valor]) => valor !== '')
    .map(([k, valor]) => `${etiquetaCampo(k)}: ${valor}`);
  return vals.slice(0, MAX_CAMPOS_RESULTADO).join(' | ') + (vals.length > MAX_CAMPOS_RESULTADO ? '...' : '');
}
