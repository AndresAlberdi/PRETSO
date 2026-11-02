import { camposReferenciaCompania, esCampoCompaniaCorpus, siglaParaExportar, TEXTO_COMPANIA_NO_ENCONTRADA, TEXTO_COMPANIA_SIN_SIGLA, canonizarReferencia, type CompaniaRef } from './referenciaCompania';
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

/**
 * Textos de compañía por los que se puede encontrar un registro: la sigla (o el
 * nombre) de las compañías que referencia. Los registros guardan el número, que
 * nadie escribe al buscar. No incluye los rótulos fijos («no encontrada», «sin
 * sigla»). `cache` (opcional) evita resolver varias veces la misma referencia.
 */
export function textosCompaniaBuscables(
  registro: Record<string, unknown>,
  coleccion: string,
  companias: CompaniaRef[],
  cache?: Map<string, string>,
): string[] {
  const resolver = (v: unknown): string => {
    if (!cache) return siglaParaExportar(v, companias);
    const clave = canonizarReferencia(v);
    let texto = cache.get(clave);
    if (texto === undefined) {
      texto = siglaParaExportar(v, companias);
      cache.set(clave, texto);
    }
    return texto;
  };
  const refs = camposReferenciaCompania(coleccion);
  const esReferencia = (k: string) =>
    coleccion === 'corpus_christi' ? esCampoCompaniaCorpus(k) : refs.includes(k);
  return Object.entries(registro)
    .filter(([k, v]) => esReferencia(k) && v)
    .map(([, v]) => resolver(v))
    .filter(t => t !== '' && t !== TEXTO_COMPANIA_NO_ENCONTRADA && t !== TEXTO_COMPANIA_SIN_SIGLA);
}
