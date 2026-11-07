/**
 * Campos que se retiraron del sistema por decisión de la investigación (Laura
 * Paz, 02/11/2026): ya no se piden, no se muestran, no salen en el Excel ni en
 * la copia XML. Los registros importados pueden conservarlos hasta que
 * `scripts/retirar_campos_obsoletos.py` los borre de la base; mientras tanto la
 * interfaz y las exportaciones los ignoran.
 */
export const CAMPOS_RETIRADOS: Readonly<Record<string, readonly string[]>> = {
  manejo_de_caja: ['Datos sobre normativa de manejo de caja'],
  salarios: [
    'Días de ración en un año',
    'Número estimado de representaciones por año',
    'Número de representaciones  por año ',
  ],
};

export function esCampoRetirado(coleccion: string, campo: string): boolean {
  return (CAMPOS_RETIRADOS[coleccion] ?? []).includes(campo);
}
