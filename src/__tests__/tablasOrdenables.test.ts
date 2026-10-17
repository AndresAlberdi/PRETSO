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

function etiquetasOrdenables(archivo: string): string[] {
  const texto = readFileSync(join(PAGINAS, archivo), 'utf-8');
  const resultado: string[] = [];
  for (const linea of texto.split('\n')) {
    if (!/<th\b[^>]*\bonClick/.test(linea)) continue;
    const m = linea.match(/>\s*([^<>]*?)\s*<SortIndicator/);
    resultado.push(m ? m[1] : '?');
  }
  return resultado;
}

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
    expect(texto).toMatch(/>Nro\. <SortIndicator column="Num" \/>/);
    expect(texto).not.toMatch(/>Num <SortIndicator/);
  });

  it('FIELD_LABEL_MAP de GenericEditModal mapea Num a Nro.', () => {
    const texto = readFileSync(join(SRC, 'components', 'GenericEditModal.tsx'), 'utf-8');
    expect(texto).toContain("'Num': 'Nro.'");
  });

  it('el campo de datos y la exportación siguen usando «Num»', () => {
    const xlsx = readFileSync(join(SRC, 'utils', 'xlsxExport.ts'), 'utf-8');
    expect(xlsx).not.toContain('Nro.');
  });
});
