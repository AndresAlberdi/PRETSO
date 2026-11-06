const RESERVADOS = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/** Convierte un texto en un nombre de archivo válido en Windows, macOS y Linux, conservando tildes y ñ. */
export function sanearNombreArchivo(texto: string): string {
  let t = texto
    .normalize('NFC')
    .split('').map((ch) => (ch.charCodeAt(0) < 0x20 || ch.charCodeAt(0) === 0x7f ? '-' : ch)).join('')
    .replace(/[/\\:*?"<>|]/g, '-')
    .replace(/ {2,}/g, ' ')
    .replace(/-{2,}/g, '-')
    .replace(/^[ .-]+|[ .-]+$/g, '');
  t = Array.from(t).slice(0, 80).join('').replace(/^[ .-]+|[ .-]+$/g, '');
  if (t === '') return 'sin-nombre';
  if (RESERVADOS.test(t)) {
    const punto = t.indexOf('.');
    t = punto === -1 ? `${t}_` : `${t.slice(0, punto)}_${t.slice(punto)}`;
  }
  return t;
}

const claveComparable = (base: string) => base.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

/** Evita nombres repetidos (sin distinguir mayúsculas ni tildes) añadiendo -2, -3… */
export function asignarNombresUnicos(bases: readonly string[]): string[] {
  const usados = new Set<string>();
  return bases.map((base) => {
    let candidato = base;
    let n = 2;
    while (usados.has(claveComparable(candidato))) {
      candidato = `${base}-${n}`;
      n += 1;
    }
    usados.add(claveComparable(candidato));
    return candidato;
  });
}
