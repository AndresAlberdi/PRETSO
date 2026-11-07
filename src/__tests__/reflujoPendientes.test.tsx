import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import SearchBar from '../components/SearchBar';

// Pruebas de los reflujos pendientes a 320 px CSS (WCAG 1.4.10). jsdom no calcula layout:
// se verifican las fuentes y los estilos, no las medidas.
const SRC = resolve(__dirname, '..');
const leer = (ruta: string) => readFileSync(join(SRC, ruta), 'utf8');

afterEach(cleanup);

describe('reflujo a 320 px: pendientes F4', () => {
  it('el selector de documentos no fija un mínimo mayor que el panel', () => {
    const fuente = leer('components/GenericCreateModal.tsx');
    expect(fuente.includes('minmax(min(200px, 100%), 1fr)')).toBe(true);
    expect(fuente.includes('minmax(200px, 1fr)')).toBe(false);
  });

  it('las fichas de filtro se limitan al ancho y parten la consulta larga', () => {
    const lineas = leer('components/SearchBar.tsx').split('\n');
    const ficha = lineas.find(l => l.includes('<div key={f.id}')) ?? '';
    expect(ficha.includes("maxWidth: '100%'")).toBe(true);
    const consulta = lineas.find(l => l.includes('{f.query}</span>')) ?? '';
    expect(consulta.includes("overflowWrap: 'anywhere'")).toBe(true);
  });

  it('las filas de secciones de Búsqueda general pasan el nombre largo a otra línea', () => {
    const fuente = leer('pages/Busqueda.tsx');
    expect(fuente.includes('className="lista-secciones"')).toBe(true);
    expect(fuente.includes('className="fila-seccion"')).toBe(true);
    expect(fuente.includes('className="nombre-seccion"')).toBe(true);
    const css = leer('index.css');
    expect(css.includes('.nombre-seccion { flex: 1; min-width: 0; overflow-wrap: anywhere;')).toBe(true);
  });

  it('una consulta larga sin espacios se renderiza con corte de palabra', () => {
    render(<SearchBar onSearch={() => {}} categories={[{ id: 'x', label: 'Texto libre' }]} />);
    const larga = 'x'.repeat(120);
    fireEvent.change(screen.getByPlaceholderText('Añadir filtro...'), { target: { value: larga } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Agregar' })[0]);
    const span = screen.getByText(larga);
    expect(span.style.overflowWrap).toBe('anywhere');
    expect(span.style.minWidth).toBe('0px');
  });
});
