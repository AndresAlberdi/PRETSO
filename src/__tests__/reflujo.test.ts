import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Pruebas estáticas del reflujo a 320 px CSS (WCAG 1.4.10). jsdom no calcula layout:
// se verifican las fuentes y el CSS, no las medidas.
const SRC = resolve(__dirname, '..');
const leer = (ruta: string) => readFileSync(join(SRC, ruta), 'utf8');
const css = leer('index.css');

const PAGINAS_CABECERA = [
  'Auditoria', 'Bibliografia', 'CorpusChristi', 'Documentos', 'Indicadores',
  'IndiceCompanias', 'ManejoCaja', 'Salarios', 'Transacciones',
];
const PAGINAS_ACCIONES = [
  'CorpusChristi', 'Documentos', 'Indicadores', 'IndiceCompanias', 'ManejoCaja', 'Salarios', 'Transacciones',
];
const PAGINAS_FILTROS = ['ManejoCaja', 'Salarios', 'CorpusChristi', 'Indicadores'];

// Devuelve el cuerpo de un bloque @media (entre llaves, con las anidadas balanceadas).
function bloqueMedia(consulta: string): string {
  const inicio = css.indexOf(`@media (${consulta}) {`);
  expect(inicio, `falta @media (${consulta})`).toBeGreaterThanOrEqual(0);
  let i = css.indexOf('{', inicio) + 1;
  const desde = i;
  let nivel = 1;
  while (nivel > 0 && i < css.length) {
    if (css[i] === '{') nivel++;
    else if (css[i] === '}') nivel--;
    i++;
  }
  return css.slice(desde, i - 1);
}

function archivosTsx(dir: string): string[] {
  return readdirSync(join(SRC, dir)).filter(f => f.endsWith('.tsx')).map(f => `${dir}/${f}`);
}

describe('reflujo: CSS', () => {
  it('.tabla-desplazable desplaza dentro de su caja', () => {
    const m = css.match(/\.tabla-desplazable\s*\{([^}]*)\}/);
    expect(m).not.toBeNull();
    expect(m![1]).toMatch(/overflow-x:\s*auto/);
    expect(m![1]).toMatch(/max-width:\s*100%/);
  });

  it('el salto de línea de la cabecera vive solo en @media (max-width: 64em)', () => {
    const media = bloqueMedia('max-width: 64em');
    expect(media).toMatch(/\.cabecera-pagina,\s*\.acciones-cabecera,\s*\.barra-busqueda\s*\{\s*flex-wrap:\s*wrap;\s*\}/);
    const base = css.match(/^\.cabecera-pagina\s*\{([^}]*)\}/m);
    expect(base).not.toBeNull();
    expect(base![1]).not.toMatch(/flex-wrap/);
  });

  it('el teléfono (30em) reduce el relleno de main y el h1', () => {
    const media = bloqueMedia('max-width: 30em');
    expect(media).toMatch(/\.contenido-principal\s*\{\s*padding:\s*1rem;\s*\}/);
    expect(media).toMatch(/h1\s*\{\s*font-size:\s*1\.75rem;\s*\}/);
  });

  it('los encabezados parten palabras largas', () => {
    expect(css).toMatch(/overflow-wrap:\s*anywhere/);
  });
});

describe('reflujo: tablas y cabeceras de página', () => {
  it('cada tabla de datos tiene su propio contenedor desplazable y no queda overflowX', () => {
    for (const archivo of archivosTsx('pages')) {
      const s = leer(archivo);
      expect(s, `${archivo} usa overflowX`).not.toMatch(/overflowX/);
      for (const m of s.matchAll(/<table\b/g)) {
        const i = m.index!;
        const antes = s.slice(0, i);
        const contenedor = antes.lastIndexOf('className="tabla-desplazable"');
        const cierre = antes.lastIndexOf('</table>');
        expect(contenedor, `${archivo}: tabla en ${i} sin contenedor`).toBeGreaterThan(cierre);
      }
    }
  });

  it('las 9 páginas con cabecera usan la clase y no el estilo en línea', () => {
    for (const p of PAGINAS_CABECERA) {
      const s = leer(`pages/${p}.tsx`);
      expect(s.match(/className="cabecera-pagina"/g)?.length, p).toBe(1);
      expect(s, p).not.toContain(`justifyContent: 'space-between', alignItems: 'center', marginBottom: "1rem"`);
    }
  });

  it('las acciones de cabecera y las filas de filtros usan su clase', () => {
    for (const p of PAGINAS_ACCIONES) expect(leer(`pages/${p}.tsx`), p).toContain('className="acciones-cabecera"');
    for (const p of PAGINAS_FILTROS) expect(leer(`pages/${p}.tsx`), p).toContain('className="fila-filtros"');
  });
});

describe('reflujo: anchos fijos', () => {
  it('ningún ancho fijo >= 200 px sin maxWidth 100 % y ningún minWidth fijo >= 200 px', () => {
    const archivos = [...archivosTsx('pages'), ...archivosTsx('components')];
    for (const archivo of archivos) {
      const s = leer(archivo);
      for (const m of s.matchAll(/style=\{\{([\s\S]*?)\}\}/g)) {
        const objeto = m[1];
        for (const w of objeto.matchAll(/(?<![A-Za-z])width:\s*'(\d+)px'/g)) {
          if (Number(w[1]) >= 200) {
            expect(objeto, `${archivo}: width ${w[1]}px sin maxWidth`).toContain("maxWidth: '100%'");
          }
        }
        for (const w of objeto.matchAll(/minWidth:\s*'(\d+)px'/g)) {
          expect(Number(w[1]), `${archivo}: minWidth ${w[1]}px`).toBeLessThan(200);
        }
      }
    }
  });
});

describe('reflujo: componentes', () => {
  it('la barra de búsqueda y el main usan sus clases', () => {
    const linea = leer('components/SearchBar.tsx').split('\n').find(l => l.includes('<form onSubmit={handleAddFilter}'));
    expect(linea).toContain('className="barra-busqueda"');
    expect(leer('App.tsx')).toContain('<main id="contenido" tabIndex={-1} className="contenido-principal">');
  });

  it('las tarjetas de Inicio y el menú evitan el desbordamiento', () => {
    const inicio = leer('pages/Inicio.tsx');
    expect(inicio).toContain('flexShrink: 0');
    expect(inicio).toContain("minWidth: 0, overflowWrap: 'anywhere'");
    expect(leer('components/MainNav.tsx')).toContain("flexWrap: 'wrap'");
  });
});
