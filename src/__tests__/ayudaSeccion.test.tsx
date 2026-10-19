import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import Tooltip from '../components/Tooltip';

const SRC = resolve(__dirname, '..');
const leer = (ruta: string) => readFileSync(join(SRC, ruta), 'utf8');
const PAGINAS = ['Indicadores', 'Salarios', 'CorpusChristi', 'ManejoCaja'];

afterEach(cleanup);

function montar() {
  const { container } = render(<Tooltip label="Acerca de X" content="texto de ayuda" />);
  const boton = screen.getByRole('button', { name: 'Acerca de X' });
  const panel = container.querySelector(`[id="${boton.getAttribute('aria-controls')}"]`) as HTMLElement;
  return { container, boton, panel };
}

describe('Ayuda de sección: comportamiento', () => {
  it('inicia cerrada, con nombre accesible y sin title', () => {
    const { container, boton, panel } = montar();
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(panel).not.toBeNull();
    expect(panel.hidden).toBe(true);
    expect(container.querySelector('[title]')).toBeNull();
  });

  it('el clic la abre y un segundo clic la cierra', () => {
    const { boton, panel } = montar();
    fireEvent.click(boton);
    expect(boton.getAttribute('aria-expanded')).toBe('true');
    expect(panel.hidden).toBe(false);
    expect(panel.textContent).toBe('texto de ayuda');
    fireEvent.click(boton);
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hidden).toBe(true);
  });

  it('Escape la cierra y el foco sigue en el botón', () => {
    const { boton, panel } = montar();
    boton.focus();
    fireEvent.click(boton);
    fireEvent.keyDown(boton, { key: 'Escape' });
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hidden).toBe(true);
    expect(document.activeElement).toBe(boton);
  });

  it('al perder el foco se cierra', () => {
    const { boton, panel } = montar();
    fireEvent.click(boton);
    fireEvent.blur(boton);
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(panel.hidden).toBe(true);
  });
});

describe('Ayuda de sección: páginas y CSS (estático)', () => {
  for (const pagina of PAGINAS) {
    it(`${pagina}: el Tooltip va fuera del h1`, () => {
      const fuente = leer(`pages/${pagina}.tsx`);
      expect(fuente.includes('className="titulo-pagina"')).toBe(true);
      expect(fuente.includes('<Tooltip label="Acerca de ')).toBe(true);
      const cierreH1 = fuente.indexOf('</h1>');
      const tooltip = fuente.indexOf('<Tooltip');
      expect(cierreH1).toBeGreaterThan(-1);
      expect(tooltip).toBeGreaterThan(cierreH1);
      expect(fuente.includes("<h1 style={{ display: 'flex'")).toBe(false);
    });
  }

  it('el panel no declara display (el atributo hidden debe poder ocultarlo)', () => {
    const css = leer('index.css');
    const inicio = css.indexOf('.ayuda-seccion-panel {');
    expect(inicio).toBeGreaterThan(-1);
    const regla = css.slice(inicio, css.indexOf('}', inicio));
    expect(regla.includes('display')).toBe(false);
  });
});
