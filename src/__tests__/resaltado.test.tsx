import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { Resaltado, TextoCoincidencia, CLASE_BOTON_COINCIDENCIA, CLASE_FILA_COINCIDENCIA } from '../components/Resaltado';

afterEach(cleanup);
const marcas = (c: HTMLElement) => [...c.querySelectorAll('mark.coincidencia')].map(m => m.textContent);

describe('Resaltado', () => {
  it('sin término no hay marcas', () => {
    const { container } = render(<Resaltado texto="Juan García" termino={null} />);
    expect(container.textContent).toBe('Juan García');
    expect(container.querySelector('mark')).toBeNull();
  });

  it('«garcia» marca «García»', () => {
    const { container } = render(<Resaltado texto="Juan García" termino="garcia" />);
    expect(marcas(container)).toEqual(['García']);
    expect(container.textContent).toBe('Juan García');
  });

  it('marca varias apariciones', () => {
    const { container } = render(<Resaltado texto="Lima y lima de nuevo" termino="lima" />);
    expect(marcas(container)).toEqual(['Lima', 'lima']);
  });

  it('con anio, «1581» marca el rango completo', () => {
    const { container } = render(<Resaltado texto="De 1580 a 1581" termino="1581" anio />);
    expect(marcas(container)).toEqual(['De 1580 a 1581']);
  });

  it('un texto con etiquetas aparece literal', () => {
    const { container } = render(<Resaltado texto="<script>alert(1)</script> García" termino="garcia" />);
    expect(container.querySelector('script')).toBeNull();
    expect(container.textContent).toBe('<script>alert(1)</script> García');
  });

  it('null, undefined y vacío dan vacío', () => {
    for (const v of [null, undefined, '']) {
      const { container } = render(<Resaltado texto={v} termino="garcia" />);
      expect(container.textContent).toBe('');
    }
  });

  it('un número se muestra como texto', () => {
    const { container } = render(<Resaltado texto={1600} termino="1600" anio />);
    expect(container.textContent).toBe('1600');
  });
});

describe('TextoCoincidencia y clases', () => {
  it('el texto oculto contiene lo buscado', () => {
    const { container } = render(<TextoCoincidencia crudo="Alberto" />);
    const span = container.querySelector('span.visually-hidden');
    expect(span?.textContent).toContain('«Alberto»');
  });

  it('exporta las clases de coincidencia', () => {
    expect(CLASE_BOTON_COINCIDENCIA).toBe('boton-con-coincidencia');
    expect(CLASE_FILA_COINCIDENCIA).toBe('fila-con-coincidencia');
  });
});
