import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve(__dirname, '..');
const PAGINAS = join(SRC, 'pages');

// Encabezados que ordenan, por página y en orden de aparición. Fuente: pedido de la responsable
// científica (solo ordenan las columnas listadas). Si se agrega un encabezado con orden, esta
// prueba falla y obliga a justificarlo. «Resultados de búsqueda» y listas principales se conservan.
const ESPERADO: Record<string, string[]> = {
  'Bibliografia.tsx': ['Autores', 'Referencias bibliográficas'],
  'CorpusChristi.tsx': ['Ciudad', 'Año', 'Encargado', 'Monto a pagar', 'Ciudad', 'Año'],
  'Documentos.tsx': ['Doc ID'],
  'IndiceCompanias.tsx': ['Sigla (Compañías)', 'Autores', 'Temporadas Teatrales', 'Ámbito'],
  'Indicadores.tsx': ['Ciudad', 'Año', 'Concepto', 'Monto', 'Categoría', 'Ciudad', 'Años'],
  'ManejoCaja.tsx': ['Compañía', 'Ciudad', 'Año', 'Compañía', 'Autores', 'Temporadas', 'Ámbito'],
  'Salarios.tsx': ['Compañía', 'Ciudad', 'Año', 'Compañía', 'Autores', 'Temporadas', 'Ámbito'],
  'Transacciones.tsx': ['Nro.'],
};

// Páginas ya migradas al componente SortableTh (C1 y C2): en ellas no puede reaparecer un <th onClick>.
const MIGRADAS = [
  'Bibliografia.tsx',
  'Documentos.tsx',
  'Transacciones.tsx',
  'CorpusChristi.tsx',
  'Indicadores.tsx',
  'ManejoCaja.tsx',
  'Salarios.tsx',
  'IndiceCompanias.tsx',
];

// Analiza el texto completo (no línea por línea): cada bloque <th ...>...</th> es ordenable si
// contiene onClick o SortIndicator (también cuando hay un <button> dentro), aunque esté en varias líneas.
// Un <SortableTh label="..." /> también es ordenable; su etiqueta es el valor de «label».
function etiquetasOrdenablesEnTexto(texto: string): string[] {
  const resultado: string[] = [];
  for (const [bloque] of texto.matchAll(/<th\b[\s\S]*?<\/th>|<SortableTh\b[\s\S]*?\/>/g)) {
    if (bloque.startsWith('<SortableTh')) {
      const etiqueta = bloque.match(/\blabel="([^"]*)"/);
      resultado.push(etiqueta ? etiqueta[1].trim() || '?' : '?');
      continue;
    }
    if (!/onClick|<SortIndicator/.test(bloque)) continue;
    // El «>» de «=>» dentro del atributo no cierra la etiqueta de apertura.
    const m = bloque.match(/(?<!=)>([^<>]*)<SortIndicator/);
    const visible = m ? m[1] : bloque.replace(/<[^>]*>/g, ' ').replace(/\{[^}]*\}/g, ' ');
    resultado.push(visible.replace(/\s+/g, ' ').trim() || '?');
  }
  return resultado;
}

// Hay un <th> con onClick (el patrón inaccesible que SortableTh reemplaza).
function tieneThConOnClick(texto: string): boolean {
  return [...texto.matchAll(/<th\b[\s\S]*?<\/th>/g)].some(([bloque]) => /onClick/.test(bloque));
}

function etiquetasOrdenables(archivo: string): string[] {
  return etiquetasOrdenablesEnTexto(readFileSync(join(PAGINAS, archivo), 'utf-8'));
}

describe('detector de encabezados ordenables', () => {
  it('detecta un <th> ordenable escrito en varias líneas', () => {
    const texto = `<th
      style={{ cursor: 'pointer' }}
      onClick={() => requestSort('Ciudad')}
    >
      Ciudad
      <SortIndicator column="Ciudad" />
    </th>`;
    expect(etiquetasOrdenablesEnTexto(texto)).toEqual(['Ciudad']);
  });

  it('detecta un <th> con <button> dentro', () => {
    const texto = `<th scope="col"><button type="button" onClick={() => requestSort('Año')}>Año <SortIndicator column="Año" /></button></th>`;
    expect(etiquetasOrdenablesEnTexto(texto)).toEqual(['Año']);
  });

  it('detecta un <SortableTh> en una o varias líneas', () => {
    const texto = `<SortableTh label="Doc ID" sortKey="Doc" sortConfig={sortConfig} onSort={requestSort} style={{ width: '80px' }} />
    <SortableTh
      label="Referencias bibliográficas"
      sortKey="Referencias bibliográficas"
      sortConfig={sortConfig}
      onSort={requestSort}
    />`;
    expect(etiquetasOrdenablesEnTexto(texto)).toEqual(['Doc ID', 'Referencias bibliográficas']);
  });

  it('conserva el orden de aparición entre <th onClick> y <SortableTh>', () => {
    const texto = `<th onClick={() => requestSort('A')}>Uno <SortIndicator column="A" /></th>
    <SortableTh label="Dos" sortKey="B" sortConfig={null} onSort={f} />`;
    expect(etiquetasOrdenablesEnTexto(texto)).toEqual(['Uno', 'Dos']);
  });

  it('tieneThConOnClick distingue el <th onClick> del <SortableTh>', () => {
    expect(tieneThConOnClick(`<th onClick={() => x()}>A</th>`)).toBe(true);
    expect(tieneThConOnClick(`<th\n onClick={() => x()}\n>A</th>`)).toBe(true);
    expect(tieneThConOnClick(`<SortableTh label="A" sortKey="a" sortConfig={null} onSort={f} />`)).toBe(false);
    expect(tieneThConOnClick(`<th scope="col">A</th>`)).toBe(false);
  });

  it('no marca como ordenable un <th scope="col"> sin onClick', () => {
    const texto = `<thead><tr><th scope="col">Noticia</th><th scope="col">
      Fuentes
    </th></tr></thead>`;
    expect(etiquetasOrdenablesEnTexto(texto)).toEqual([]);
  });
});

describe('tablas: encabezados que ordenan', () => {
  const archivos = readdirSync(PAGINAS).filter((f) => f.endsWith('.tsx'));

  for (const [archivo, etiquetas] of Object.entries(ESPERADO)) {
    it(`${archivo} ordena solo ${etiquetas.length} columnas`, () => {
      expect(etiquetasOrdenables(archivo)).toEqual(etiquetas);
    });
  }

  it('ninguna otra página tiene encabezados con orden', () => {
    for (const f of archivos.filter((a) => !(a in ESPERADO))) {
      expect(etiquetasOrdenables(f), f).toEqual([]);
    }
  });

  it('quedan 35 encabezados con orden en total', () => {
    const total = archivos.reduce((n, f) => n + etiquetasOrdenables(f).length, 0);
    expect(total).toBe(35);
  });

  for (const archivo of MIGRADAS) {
    it(`${archivo} (migrada) usa SortableTh y no tiene <th onClick>`, () => {
      expect(archivo in ESPERADO, `${archivo} debe estar en ESPERADO`).toBe(true);
      const texto = readFileSync(join(PAGINAS, archivo), 'utf-8');
      expect(tieneThConOnClick(texto), `${archivo}: reapareció un <th onClick>`).toBe(false);
      expect(texto).toContain('<SortableTh');
      expect(texto).not.toContain('<SortIndicator');
    });
  }

  for (const archivo of MIGRADAS) {
    it(`${archivo}: en cada <thead> todos los SortableTh usan el mismo sortConfig y onSort`, () => {
      const texto = readFileSync(join(PAGINAS, archivo), 'utf-8');
      const bloques = [...texto.matchAll(/<thead>[\s\S]*?<\/thead>/g)].map(([b]) => b);
      for (const bloque of bloques) {
        const pares = [...bloque.matchAll(/<SortableTh\b[\s\S]*?\/>/g)].map(([s]) => {
          const sc = s.match(/\bsortConfig=\{(\w+)\}/);
          const os = s.match(/\bonSort=\{(\w+)\}/);
          expect(sc, `${archivo}: SortableTh sin sortConfig`).not.toBeNull();
          expect(os, `${archivo}: SortableTh sin onSort`).not.toBeNull();
          return `${sc![1]}/${os![1]}`;
        });
        expect(new Set(pares).size, `${archivo}: pares mezclados ${[...new Set(pares)].join(', ')}`).toBeLessThanOrEqual(1);
      }
    });
  }

  it('los encabezados sin orden de las tablas de detalle llevan scope="col"', () => {
    const sinOrden: Record<string, string[]> = {
      'Documentos.tsx': ['Documento'],
      'Transacciones.tsx': ['Noticia', 'Fuentes'],
      'ManejoCaja.tsx': ['Ingresos', 'Egresos', 'Otros bienes'],
      'Salarios.tsx': ['Personas', 'Ocupación', 'Remuneración'],
      'CorpusChristi.tsx': ['Encargo', 'Fondos'],
      'Indicadores.tsx': ['Nota'],
    };
    for (const [f, etiquetas] of Object.entries(sinOrden)) {
      const texto = readFileSync(join(PAGINAS, f), 'utf-8');
      for (const e of etiquetas) {
        expect(texto, `${f}: ${e}`).toContain(`<th scope="col">${e}</th>`);
      }
    }
  });
});

describe('«Num» se muestra como «Nro.»', () => {
  it('el encabezado de Transacciones dice «Nro.» y no «Num»', () => {
    const texto = readFileSync(join(PAGINAS, 'Transacciones.tsx'), 'utf-8');
    expect(texto).toMatch(/<SortableTh label="Nro\." sortKey="Num"/);
    expect(texto).not.toMatch(/label="Num"/);
    expect(texto).toContain('sortKey="Num"');
  });

  it('FIELD_LABEL_MAP de GenericEditModal mapea Num a Nro.', () => {
    const texto = readFileSync(join(SRC, 'components', 'GenericEditModal.tsx'), 'utf-8');
    expect(texto).toContain("'Num': 'Nro.'");
  });

  it('el campo de datos y la exportación siguen usando «Num»', () => {
    const xlsx = readFileSync(join(SRC, 'utils', 'xlsxExport.ts'), 'utf-8');
    expect(xlsx).toMatch(/transacciones:\s*\['Num'/);
    expect(xlsx).not.toContain('Nro.');
    const modal = readFileSync(join(SRC, 'components', 'TransactionModal.tsx'), 'utf-8');
    expect(modal).toContain("where('Num'");
  });
});
