import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const SRC = resolve(__dirname, '..');

// Archivos .tsx de producción (se excluyen las pruebas).
function archivosTsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : archivosTsx(ruta);
    return e.name.endsWith('.tsx') ? [ruta] : [];
  });
}

const archivos = archivosTsx(SRC).map(ruta => ({
  nombre: relative(SRC, ruta).split('\\').join('/'),
  texto: readFileSync(ruta, 'utf8'),
}));

// Devuelve el texto del objeto `{ ... }` más interno que rodea la posición dada.
function objetoQueRodea(texto: string, pos: number): string {
  let profundidad = 0;
  let ini = pos;
  while (ini > 0) {
    const c = texto[ini];
    if (c === '}') profundidad++;
    if (c === '{') {
      if (profundidad === 0) break;
      profundidad--;
    }
    ini--;
  }
  profundidad = 0;
  let fin = pos;
  while (fin < texto.length) {
    const c = texto[fin];
    if (c === '{') profundidad++;
    if (c === '}') {
      if (profundidad === 0) break;
      profundidad--;
    }
    fin++;
  }
  return texto.slice(ini, fin + 1);
}

// Fondos de ventana: position fixed anclado arriba (top: 0). Los avisos flotantes usan `bottom`.
function tieneFondoDeVentana(texto: string): boolean {
  const re = /position:\s*['"]fixed['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto))) {
    if (/\btop:\s*0\b/.test(objetoQueRodea(texto, m.index))) return true;
  }
  return false;
}

describe('las ventanas modales usan el componente compartido', () => {
  it('aria-modal aparece solo en components/Modal.tsx', () => {
    const con = archivos.filter(a => a.texto.includes('aria-modal')).map(a => a.nombre);
    expect(con).toEqual(['components/Modal.tsx']);
  });

  it('todo fondo fijo con top: 0 importa Modal o BusyModal', () => {
    const conFondo = archivos.filter(a => tieneFondoDeVentana(a.texto));
    // Sanidad: el detector encuentra las ventanas conocidas (no pasa por vacío).
    expect(conFondo.length).toBeGreaterThanOrEqual(8);
    const sinModal = conFondo
      .filter(a => !/import\s+(Modal|BusyModal)\s+from\s+['"][^'"]*\/(Modal|BusyModal)['"]/.test(a.texto))
      .map(a => a.nombre);
    expect(sinModal).toEqual([]);
  });

  it('los avisos flotantes con bottom no se confunden con ventanas', () => {
    expect(tieneFondoDeVentana("<div style={{ position: 'fixed', bottom: '2rem', right: '2rem' }}>")).toBe(false);
    expect(tieneFondoDeVentana("<div style={{ position: 'fixed', top: 0, left: 0 }}>")).toBe(true);
  });
});
