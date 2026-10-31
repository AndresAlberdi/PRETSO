import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';

const SRC = resolve(__dirname, '..');

// Guardia estática: todo <textarea> o <input type="text"> declara el corrector ortográfico
// (TEXTO_LIBRE, TEXTO_CODIGO o propsCorrector), para que un campo nuevo no lo omita.
function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : archivos(ruta);
    return e.name.endsWith('.tsx') ? [ruta] : [];
  });
}

// Texto de la etiqueta de apertura desde `inicio`, respetando llaves y comillas
// (los atributos pueden contener `>` dentro de funciones flecha).
function etiqueta(texto: string, inicio: number): string {
  let llaves = 0;
  let comilla = '';
  for (let i = inicio; i < texto.length; i++) {
    const c = texto[i];
    if (comilla) { if (c === comilla) comilla = ''; continue; }
    if (llaves === 0 && (c === '"' || c === "'")) { comilla = c; continue; }
    if (c === '{') llaves++;
    else if (c === '}') llaves--;
    else if (c === '>' && llaves === 0) return texto.slice(inicio, i + 1);
  }
  return texto.slice(inicio);
}

describe('guardia del corrector ortográfico', () => {
  it('todo campo de texto libre declara el corrector', () => {
    const fallos: string[] = [];
    let controles = 0;
    for (const archivo of archivos(SRC)) {
      const texto = readFileSync(archivo, 'utf8');
      for (const m of texto.matchAll(/<(textarea|input)\b/g)) {
        const tag = etiqueta(texto, m.index as number);
        const esTexto = m[1] === 'textarea' || /type="text"/.test(tag);
        if (!esTexto) continue;
        controles++;
        if (!/\{\.\.\.(TEXTO_LIBRE|TEXTO_CODIGO|propsCorrector\()/.test(tag)) {
          const linea = texto.slice(0, m.index).split('\n').length;
          fallos.push(`${relative(SRC, archivo)}:${linea} sin atributos del corrector ortográfico`);
        }
      }
    }
    expect(fallos).toEqual([]);
    expect(controles).toBeGreaterThanOrEqual(35);
  });
});
