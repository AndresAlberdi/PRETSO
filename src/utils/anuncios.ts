/** Formatea una cantidad con su sustantivo en singular o plural, para anuncios a lectores de pantalla. */
export function contar(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}
