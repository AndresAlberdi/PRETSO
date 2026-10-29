import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

const RAIZ = resolve(__dirname, '..', '..');
const SRC = join(RAIZ, 'src');

function listar(dir: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    if (nombre === '__tests__') continue;
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...listar(ruta));
    else if (/\.(css|ts|tsx)$/.test(nombre)) salida.push(ruta);
  }
  return salida;
}

const css = readFileSync(join(SRC, 'index.css'), 'utf8');
const raiz = css.slice(css.indexOf(':root'), css.indexOf('}', css.indexOf(':root')));

function variable(nombre: string): string {
  const m = raiz.match(new RegExp(`${nombre}:\\s*([^;]+);`));
  if (!m) throw new Error(`Falta la variable ${nombre}`);
  return m[1].trim();
}

function luminancia(hex: string): number {
  const h = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contraste(a: string, b: string): number {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

describe('paleta golden rose', () => {
  it('no queda ningún amarillo del ámbar anterior', () => {
    const archivos = [...listar(SRC), join(RAIZ, 'index.html')];
    const patron = /f1b04c|f3be6d|e5a93b|241,\s*176,\s*76/i;
    const con = archivos.filter((f) => patron.test(readFileSync(f, 'utf8')));
    expect(con).toEqual([]);
  });

  it('define los colores de la paleta en :root', () => {
    expect(variable('--primary-color')).toBe('#E6B1A1');
    expect(variable('--primary-hover')).toBe('#EDBFB4');
    expect(variable('--on-primary')).toBe('#0b0f19');
    expect(variable('--editor-color')).toBe('#ff6b6b');
    expect(css).toContain('#D99A8A');
  });

  it('cumple los contrastes WCAG', () => {
    const fondo = variable('--bg-color');
    const p = variable('--primary-color');
    expect(contraste(variable('--on-primary'), p)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(variable('--on-primary'), variable('--primary-hover'))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(p, fondo)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(variable('--editor-text'), '#0b0f19')).toBeGreaterThanOrEqual(4.5);
    expect(contraste(variable('--on-editor'), variable('--editor-color'))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(variable('--text-muted'), fondo)).toBeGreaterThanOrEqual(4.5);
    expect(contraste('#D99A8A', fondo)).toBeGreaterThanOrEqual(4.5);
    expect(contraste(variable('--input-border'), fondo)).toBeGreaterThanOrEqual(3);
    expect(contraste(p, fondo)).toBeGreaterThanOrEqual(3);
  });
});
