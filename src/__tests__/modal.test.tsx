import { describe, it, expect, vi, afterEach } from 'vitest';
import { StrictMode, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import Modal from '../components/Modal';

afterEach(cleanup);

const base = { overlayStyle: { position: 'fixed' as const, zIndex: 1000 }, panelStyle: {} };

function Ventana({ titulo, children, ...resto }: { titulo: string; children?: ReactNode } & Partial<React.ComponentProps<typeof Modal>>) {
  const id = `t-${titulo.replace(/\s+/g, '-')}`;
  return (
    <Modal labelledBy={id} {...base} {...resto}>
      <h2 id={id}>{titulo}</h2>
      {children}
    </Modal>
  );
}

// Arnés con el botón de origen y el contenedor principal, como en App.tsx.
function Arnes({ children, conBoton = true }: { children: (cerrar: () => void) => ReactNode; conBoton?: boolean }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <main id="contenido" tabIndex={-1}>
        {conBoton && <button onClick={() => setAbierta(true)}>origen</button>}
      </main>
      {abierta && children(() => setAbierta(false))}
    </>
  );
}

function abrir() {
  const origen = screen.getByRole('button', { name: 'origen' });
  origen.focus();
  fireEvent.click(origen);
  return origen;
}

function tab(shiftKey = false, destino: Element = document.activeElement ?? document.body) {
  return fireEvent.keyDown(destino, { key: 'Tab', shiftKey });
}

describe('Modal: rol y atributos', () => {
  it('expone un diálogo modal con nombre accesible', () => {
    render(<Ventana titulo="Mi ventana"><button>uno</button></Ventana>);
    const d = screen.getByRole('dialog', { name: 'Mi ventana' });
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.getAttribute('aria-busy')).toBeNull();
  });

  it('alertdialog con descripción', () => {
    render(
      <Ventana titulo="Aviso" role="alertdialog" describedBy="desc">
        <p id="desc">Detalle</p>
        <button>ok</button>
      </Ventana>,
    );
    const d = screen.getByRole('alertdialog', { name: 'Aviso' });
    expect(d.getAttribute('aria-describedby')).toBe('desc');
  });

  it('busy marca aria-busy', () => {
    render(<Ventana titulo="Espera" busy />);
    expect(screen.getByRole('dialog', { name: 'Espera' }).getAttribute('aria-busy')).toBe('true');
  });

  it('se monta en un host fuera del contenedor del render', () => {
    const { container } = render(<Ventana titulo="V"><button>uno</button></Ventana>);
    expect(container.querySelector('[role=dialog]')).toBeNull();
    expect(document.body.querySelectorAll(':scope > [data-modal-host]')).toHaveLength(1);
  });
});

describe('Modal: foco inicial', () => {
  it('va al primer control', () => {
    render(<Ventana titulo="V"><button>uno</button><button>dos</button></Ventana>);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'uno' }));
  });

  it('respeta initialFocus', () => {
    function Con() {
      const ref = useRef<HTMLButtonElement>(null);
      return (
        <Ventana titulo="V" initialFocus={ref}>
          <button>uno</button>
          <button ref={ref}>dos</button>
        </Ventana>
      );
    }
    render(<Con />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'dos' }));
  });

  it('sin controles va al panel', () => {
    render(<Ventana titulo="V"><p>texto</p></Ventana>);
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });
});

describe('Modal: contención de Tab', () => {
  function abrirDos() {
    render(<Ventana titulo="V"><button>uno</button><button>dos</button></Ventana>);
    return { uno: screen.getByRole('button', { name: 'uno' }), dos: screen.getByRole('button', { name: 'dos' }) };
  }

  it('Tab desde el último pasa al primero', () => {
    const { uno, dos } = abrirDos();
    dos.focus();
    expect(tab()).toBe(false);
    expect(document.activeElement).toBe(uno);
  });

  it('Shift+Tab desde el primero pasa al último', () => {
    const { uno, dos } = abrirDos();
    uno.focus();
    expect(tab(true)).toBe(false);
    expect(document.activeElement).toBe(dos);
  });

  it('Tab en el medio no se intercepta', () => {
    const { uno } = abrirDos();
    uno.focus();
    expect(tab()).toBe(true);
  });

  it('Tab con el foco fuera pasa al primero', () => {
    const { uno } = abrirDos();
    (document.activeElement as HTMLElement).blur();
    expect(document.activeElement).toBe(document.body);
    tab(false, document.body);
    expect(document.activeElement).toBe(uno);
  });

  it('un foco que escapa vuelve al interior', () => {
    const { uno } = abrirDos();
    const fuera = document.createElement('button');
    document.body.appendChild(fuera);
    fuera.focus();
    expect(document.activeElement).toBe(uno);
    fuera.remove();
  });

  it('sin controles el foco se queda en el panel', () => {
    render(<Ventana titulo="V"><p>texto</p></Ventana>);
    const panel = screen.getByRole('dialog');
    expect(tab()).toBe(false);
    expect(document.activeElement).toBe(panel);
    expect(tab(true)).toBe(false);
    expect(document.activeElement).toBe(panel);
  });
});

describe('Modal: Escape', () => {
  it('invoca onEscape una vez y cancela el evento', () => {
    const onEscape = vi.fn();
    render(<Ventana titulo="V" onEscape={onEscape}><button>uno</button></Ventana>);
    expect(fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })).toBe(false);
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('sin onEscape no hace nada', () => {
    render(<Ventana titulo="V"><button>uno</button></Ventana>);
    expect(fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' })).toBe(true);
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('se ignora durante una composición de texto', () => {
    const onEscape = vi.fn();
    render(<Ventana titulo="V" onEscape={onEscape}><button>uno</button></Ventana>);
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape', isComposing: true });
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('usa el onEscape más reciente', () => {
    const a = vi.fn();
    const b = vi.fn();
    const { rerender } = render(<Ventana titulo="V" onEscape={a}><button>uno</button></Ventana>);
    rerender(<Ventana titulo="V" onEscape={b}><button>uno</button></Ventana>);
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });
});

describe('Modal: retorno del foco', () => {
  it('vuelve al botón de origen', () => {
    render(<Arnes>{cerrar => <Ventana titulo="V" onEscape={cerrar}><button>uno</button></Ventana>}</Arnes>);
    const origen = abrir();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'uno' }));
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(origen);
  });

  it('si el origen ya no existe, va a #contenido', async () => {
    function Con() {
      const [paso, setPaso] = useState<'cerrada' | 'abierta' | 'sin-origen'>('cerrada');
      return (
        <>
          <main id="contenido" tabIndex={-1}>
            {paso !== 'sin-origen' && <button onClick={() => setPaso('abierta')}>origen</button>}
          </main>
          {paso === 'abierta' && (
            <Ventana titulo="V">
              <button onClick={() => setPaso('sin-origen')}>cerrar</button>
            </Ventana>
          )}
        </>
      );
    }
    render(<Con />);
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'cerrar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await Promise.resolve();
    expect(document.activeElement).toBe(document.getElementById('contenido'));
  });
});

describe('Modal: fondo inerte', () => {
  it('el resto del documento es inerte mientras está abierta y deja de serlo al cerrar', () => {
    const { container, rerender } = render(<Ventana titulo="V"><button>uno</button></Ventana>);
    const raiz = container; // contenedor que RTL agrega a body
    expect(raiz.hasAttribute('inert')).toBe(true);
    const host = document.querySelector('[data-modal-host]') as HTMLElement;
    expect(host.hasAttribute('inert')).toBe(false);
    rerender(<div />);
    expect(raiz.hasAttribute('inert')).toBe(false);
  });

  it('un inert previo se conserva', () => {
    const previo = document.createElement('div');
    previo.setAttribute('inert', '');
    document.body.appendChild(previo);
    const { unmount } = render(<Ventana titulo="V"><button>uno</button></Ventana>);
    unmount();
    expect(previo.hasAttribute('inert')).toBe(true);
    previo.remove();
  });
});

describe('Modal: apilamiento', () => {
  it('Escape solo afecta a la superior, y al cerrarla el foco vuelve a la inferior', () => {
    const escapeA = vi.fn();
    const escapeB = vi.fn();
    function Doble() {
      const [conB, setConB] = useState(true);
      return (
        <>
          <Ventana titulo="A" onEscape={escapeA}><button>a1</button></Ventana>
          {conB && (
            <Ventana titulo="B" onEscape={() => { escapeB(); setConB(false); }} overlayStyle={{ position: 'fixed', zIndex: 500 }}>
              <button>b1</button>
            </Ventana>
          )}
        </>
      );
    }
    render(<Doble />);
    const hosts = () => Array.from(document.querySelectorAll<HTMLElement>('[data-modal-host]'));
    const [hostA, hostB] = hosts();
    expect(hostA.hasAttribute('inert')).toBe(true);
    expect(hostB.hasAttribute('inert')).toBe(false);
    const overlayA = screen.getByRole('dialog', { name: 'A', hidden: true }).parentElement as HTMLElement;
    const overlayB = screen.getByRole('dialog', { name: 'B' }).parentElement as HTMLElement;
    expect(Number(overlayB.style.zIndex)).toBeGreaterThan(Number(overlayA.style.zIndex));
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(escapeB).toHaveBeenCalledTimes(1);
    expect(escapeA).not.toHaveBeenCalled();
    expect(hostA.hasAttribute('inert')).toBe(false);
    expect(hostA.contains(document.activeElement)).toBe(true);
  });
});

describe('Modal: StrictMode', () => {
  it('un solo host, foco dentro y retorno correcto', () => {
    render(
      <StrictMode>
        <Arnes>{cerrar => <Ventana titulo="V" onEscape={cerrar}><button>uno</button></Ventana>}</Arnes>
      </StrictMode>,
    );
    const origen = abrir();
    expect(document.querySelectorAll('[data-modal-host]')).toHaveLength(1);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'uno' }));
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(document.querySelectorAll('[data-modal-host]')).toHaveLength(0);
    expect(document.activeElement).toBe(origen);
  });
});

describe('Modal: cadena de una capa sin controles a una confirmación en el mismo commit', () => {
  it('la confirmación toma el foco en «Cancelar» y al cancelar vuelve al botón de origen', () => {
    function Cadena() {
      const [paso, setPaso] = useState<'cerrada' | 'espera' | 'confirma'>('cerrada');
      const cancelar = useRef<HTMLButtonElement>(null);
      return (
        <>
          <main id="contenido" tabIndex={-1}>
            <button onClick={() => setPaso('espera')}>origen</button>
          </main>
          {paso === 'espera' && <Ventana titulo="Espera" busy />}
          {paso === 'confirma' && (
            <Ventana titulo="Confirmar" role="alertdialog" initialFocus={cancelar} onEscape={() => setPaso('cerrada')}>
              <button onClick={() => setPaso('cerrada')}>Borrar</button>
              <button ref={cancelar} onClick={() => setPaso('cerrada')}>Cancelar</button>
            </Ventana>
          )}
          {paso === 'espera' && <button hidden onClick={() => setPaso('confirma')}>pasar</button>}
        </>
      );
    }
    render(<Cadena />);
    const origen = abrir();
    expect(document.activeElement).toBe(screen.getByRole('dialog', { name: 'Espera' }));
    fireEvent.click(screen.getByText('pasar', { selector: 'button' }));
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(origen);
  });
});
