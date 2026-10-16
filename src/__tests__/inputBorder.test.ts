import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve(__dirname, '..');

function tsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.name === '__tests__'
      ? []
      : e.isDirectory()
        ? tsx(join(dir, e.name))
        : e.name.endsWith('.tsx')
          ? [join(dir, e.name)]
          : [],
  );
}

// Los campos de formulario deben usar --input-border (contraste >= 3:1, WCAG 1.4.11);
// --border-color es decorativo y queda para tarjetas, tablas y separadores.
describe('borde de campos de formulario', () => {
  it('ningún input, select o textarea usa --border-color en su borde', () => {
    const infractores: string[] = [];
    for (const f of tsx(SRC)) {
      const texto = readFileSync(f, 'utf8');
      for (const m of texto.matchAll(/<(input|select|textarea)\b/g)) {
        const resto = texto.slice(m.index);
        const fin = resto.search(/\/>|<\/(select|textarea)>/);
        const etiqueta = fin === -1 ? resto : resto.slice(0, fin);
        if (/border[A-Za-z]*\s*:[^,\n]*--border-color/.test(etiqueta)) {
          const linea = texto.slice(0, m.index).split('\n').length;
          infractores.push(`${f.slice(SRC.length + 1)}:${linea}`);
        }
      }
    }
    expect(infractores).toEqual([]);
  });
});
