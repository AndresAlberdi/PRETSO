import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useDesplazarACoincidencia, raizDeModal } from '../hooks/useDesplazarACoincidencia';

function Pagina({ clave, raiz }: { clave: string | null; raiz?: string | (() => Element | null) }) {
  useDesplazarACoincidencia(clave, raiz);
  return (
    <main id="contenido">
      <p>sin marca</p>
      <button type="button" id="foco">Foco</button>
      <mark className="coincidencia" id="primera">uno</mark>
      <mark className="coincidencia" id="segunda">dos</mark>
    </main>
  );
}

afterEach(() => {
  cleanup();
  delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
});

function simular() {
  const fn = vi.fn();
  Element.prototype.scrollIntoView = fn;
  return fn;
}

describe('useDesplazarACoincidencia', () => {
  it('desplaza a la primera coincidencia dentro de #contenido', () => {
    const fn = simular();
    render(<Pagina clave="a|1" />);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn.mock.contexts[0]).toBe(document.getElementById('primera'));
    expect(fn).toHaveBeenCalledWith({ block: 'center' });
  });

  it('con clave nula no hace nada', () => {
    const fn = simular();
    render(<Pagina clave={null} />);
    expect(fn).not.toHaveBeenCalled();
  });

  it('no mueve el foco', () => {
    simular();
    const { container } = render(<Pagina clave="a|1" />);
    (container.querySelector('#foco') as HTMLElement).focus();
    const activo = document.activeElement;
    render(<Pagina clave="b|2" />);
    expect(document.activeElement).toBe(activo);
  });

  it('sin scrollIntoView (jsdom) no falla', () => {
    expect(() => render(<Pagina clave="a|1" />)).not.toThrow();
  });

  it('repite solo cuando la clave cambia', () => {
    const fn = simular();
    const { rerender } = render(<Pagina clave="a|1" />);
    rerender(<Pagina clave="a|1" />);
    expect(fn).toHaveBeenCalledTimes(1);
    rerender(<Pagina clave="b|1" />);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('con raíz de modal busca dentro del diálogo indicado', () => {
    const fn = simular();
    function Apilados() {
      useDesplazarACoincidencia('x', raizDeModal('titulo-b'));
      return (
        <>
          <div aria-modal="true"><h2 id="titulo-a">A</h2><mark className="coincidencia" id="de-a">a</mark></div>
          <div aria-modal="true"><h2 id="titulo-b">B</h2><mark className="coincidencia" id="de-b">b</mark></div>
        </>
      );
    }
    render(<Apilados />);
    expect(fn.mock.contexts[0]).toBe(document.getElementById('de-b'));
  });
});
