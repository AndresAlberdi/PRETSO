import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve(__dirname, '..');

function archivos(dir: string, ext: string[]): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return nombre === '__tests__' ? [] : archivos(ruta, ext);
    return ext.some((e) => nombre.endsWith(e)) ? [ruta] : [];
  });
}

describe('variables CSS', () => {
  const css = readFileSync(join(SRC, 'index.css'), 'utf8');
  const raiz = /:root\s*\{([\s\S]*?)\n\}/.exec(css)?.[1] ?? '';
  const definidas = new Set([...raiz.matchAll(/(--[\w-]+)\s*:/g)].map((m) => m[1]));

  it('index.css define un :root con variables', () => {
    expect(definidas.size).toBeGreaterThan(0);
  });

  it('toda var(--x) sin valor de respaldo está definida en :root', () => {
    const fuentes = [join(SRC, 'index.css'), ...archivos(SRC, ['.tsx'])];
    const faltantes: string[] = [];
    for (const f of fuentes) {
      const texto = readFileSync(f, 'utf8');
      for (const m of texto.matchAll(/var\(\s*(--[\w-]+)\s*\)/g)) {
        if (!definidas.has(m[1])) faltantes.push(`${f.replace(SRC, 'src')}: ${m[1]}`);
      }
    }
    expect(faltantes).toEqual([]);
  });
});
