import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import ts from 'typescript';

const SRC = resolve(__dirname, '..');

// Guardia estática: todo <textarea> o <input> de texto (sin type, o con un type que no
// sea un tipo no textual conocido) declara el corrector ortográfico
// (TEXTO_LIBRE, TEXTO_CODIGO o propsCorrector), para que un campo nuevo no lo omita.
function archivos(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const ruta = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : archivos(ruta);
    return e.name.endsWith('.tsx') ? [ruta] : [];
  });
}

// Tipos de <input> que no son texto. Todo otro valor, la ausencia de type o un type
// no literal (variable, expresión) se trata como texto y exige la decisión.
const TIPOS_NO_TEXTO = new Set([
  'number', 'radio', 'checkbox', 'email', 'password', 'file', 'hidden', 'date',
  'datetime-local', 'time', 'month', 'week', 'range', 'color', 'submit', 'button',
  'reset', 'image',
]);

interface ControlTexto { linea: number; declara: boolean }

function valorLiteral(init: ts.JsxAttribute['initializer']): string | null {
  if (!init) return null;
  if (ts.isStringLiteral(init)) return init.text;
  if (ts.isJsxExpression(init) && init.expression &&
      (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression))) {
    return init.expression.text;
  }
  return null;
}

// Recorre el AST de TypeScript y devuelve cada <textarea> o <input> de texto,
// con la marca de si declara el corrector (TEXTO_LIBRE, TEXTO_CODIGO o propsCorrector(...)).
export function controlesDeTexto(codigo: string): ControlTexto[] {
  const sf = ts.createSourceFile('x.tsx', codigo, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const res: ControlTexto[] = [];
  const visitar = (n: ts.Node): void => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const nombre = n.tagName.getText(sf);
      if (nombre === 'textarea' || nombre === 'input') {
        const attrs = n.attributes.properties;
        const tipo = attrs.find((a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText(sf) === 'type');
        const literal = tipo ? valorLiteral(tipo.initializer) : null;
        const noTexto = nombre === 'input' && literal !== null && TIPOS_NO_TEXTO.has(literal);
        if (!noTexto) {
          const declara = attrs.some(a => ts.isJsxSpreadAttribute(a) &&
            /^(TEXTO_LIBRE|TEXTO_CODIGO|propsCorrector\()/.test(a.expression.getText(sf)));
          const linea = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
          res.push({ linea, declara });
        }
      }
    }
    ts.forEachChild(n, visitar);
  };
  visitar(sf);
  return res;
}

describe('analizador de la guardia', () => {
  const exige = (jsx: string) => {
    const r = controlesDeTexto(`const a = ${jsx};`);
    expect(r).toHaveLength(1);
    expect(r[0].declara).toBe(false);
  };
  const ignora = (jsx: string) => expect(controlesDeTexto(`const a = ${jsx};`)).toHaveLength(0);

  it('exige decisión en input sin type, type=\'text\', type={\'text\'}, type={variable} y type="search"', () => {
    exige('<input value={x} />');
    exige("<input type='text' value={x} />");
    exige("<input type={'text'} value={x} />");
    exige('<input type={variable} value={x} />');
    exige('<input type="search" value={x} />');
    exige('<textarea value={x} onChange={() => 1 > 0} />');
  });
  it('no exige decisión en tipos no textuales', () => {
    ignora('<input type="number" />');
    ignora('<input type="email" />');
    ignora("<input type={'checkbox'} />");
  });
  it('reconoce la declaración del corrector', () => {
    expect(controlesDeTexto('const a = <input {...TEXTO_LIBRE} />;')[0].declara).toBe(true);
    expect(controlesDeTexto('const a = <input {...propsCorrector(k, v)} />;')[0].declara).toBe(true);
  });
});

describe('guardia del corrector ortográfico', () => {
  it('todo campo de texto libre declara el corrector', () => {
    const fallos: string[] = [];
    let controles = 0;
    for (const archivo of archivos(SRC)) {
      for (const c of controlesDeTexto(readFileSync(archivo, 'utf8'))) {
        controles++;
        if (!c.declara) fallos.push(`${relative(SRC, archivo)}:${c.linea} sin atributos del corrector ortográfico`);
      }
    }
    expect(fallos).toEqual([]);
    expect(controles).toBeGreaterThanOrEqual(35);
  });
});
