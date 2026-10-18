import { describe, it, expect, vi, afterEach } from 'vitest';
import { StrictMode, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import DetailsModal from '../components/DetailsModal';
import CompaniaModal from '../components/CompaniaModal';
import DocumentModal from '../components/DocumentModal';
import TransactionModal from '../components/TransactionModal';
import { getFocusable } from '../components/modalStack';

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), where: vi.fn(), query: vi.fn(),
  getDocs: async () => ({ empty: true, docs: [] }),
}));

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

  it('un control interno que maneja su propio Escape (preventDefault) evita el cierre', () => {
    const onEscape = vi.fn();
    render(
      <Ventana titulo="V" onEscape={onEscape}>
        <input aria-label="campo" onKeyDown={e => { if (e.key === 'Escape') e.preventDefault(); }} />
        <button>uno</button>
      </Ventana>,
    );
    fireEvent.keyDown(screen.getByLabelText('campo'), { key: 'Escape' });
    expect(onEscape).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('button', { name: 'uno' }), { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('se ignora el Escape repetido (tecla mantenida)', () => {
    const onEscape = vi.fn();
    render(<Ventana titulo="V" onEscape={onEscape}><button>uno</button></Ventana>);
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape', repeat: true });
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

describe('Modal: retorno del foco, casos límite', () => {
  it('si el origen se desconectó con la ventana abierta, va a #contenido de inmediato', () => {
    function Con() {
      const [origen, setOrigen] = useState(true);
      const [abierta, setAbierta] = useState(false);
      return (
        <>
          <main id="contenido" tabIndex={-1}>
            {origen && <button onClick={() => setAbierta(true)}>origen</button>}
          </main>
          {abierta && (
            <Ventana titulo="V" onEscape={() => setAbierta(false)}>
              <button onClick={() => setOrigen(false)}>quitar origen</button>
            </Ventana>
          )}
        </>
      );
    }
    render(<Con />);
    abrir();
    fireEvent.click(screen.getByRole('button', { name: 'quitar origen' }));
    expect(screen.queryByRole('button', { name: 'origen' })).toBeNull();
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(document.getElementById('contenido'));
  });

  it('si el origen es <body> (el navegador no enfocó el botón), va a #contenido', () => {
    render(<Arnes>{cerrar => <Ventana titulo="V" onEscape={cerrar}><button>uno</button></Ventana>}</Arnes>);
    const origen = screen.getByRole('button', { name: 'origen' });
    expect(document.activeElement).toBe(document.body);
    fireEvent.click(origen);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'uno' }));
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
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

  it('un nodo agregado a <body> con la ventana abierta queda inerte, y deja de estarlo al cerrar', async () => {
    const { rerender } = render(<Ventana titulo="V"><button>uno</button></Ventana>);
    const tardio = document.createElement('div');
    document.body.appendChild(tardio);
    await waitFor(() => expect(tardio.hasAttribute('inert')).toBe(true));
    rerender(<div />);
    expect(tardio.hasAttribute('inert')).toBe(false);
    tardio.remove();
  });

  it('al vaciarse la pila se quitan todos los listeners y el observador', () => {
    const agregados = vi.spyOn(document, 'addEventListener');
    const quitados = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(<Ventana titulo="V"><button>uno</button></Ventana>);
    const propios = agregados.mock.calls.filter(([tipo]) => tipo === 'keydown' || tipo === 'focusin');
    expect(propios.length).toBeGreaterThan(0);
    unmount();
    for (const [tipo, fn, opciones] of propios) {
      expect(quitados.mock.calls.some(c => c[0] === tipo && c[1] === fn && c[2] === opciones)).toBe(true);
    }
    agregados.mockRestore();
    quitados.mockRestore();
    // Sin pila, un nodo nuevo ya no se vuelve inerte.
    const nuevo = document.createElement('div');
    document.body.appendChild(nuevo);
    return Promise.resolve().then(() => {
      expect(nuevo.hasAttribute('inert')).toBe(false);
      nuevo.remove();
    });
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
      return (
        <>
          <main id="contenido" tabIndex={-1}>
            <button onClick={() => setPaso('espera')}>origen</button>
          </main>
          {paso === 'espera' && <Ventana titulo="Espera" busy />}
          {paso === 'confirma' && (
            <ConfirmModal title="Confirmar" message="¿Seguro?" confirmText="Borrar" onConfirm={() => setPaso('cerrada')} onCancel={() => setPaso('cerrada')} />
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

describe('Modal: ventanas apiladas que se cierran en el mismo commit', () => {
  // Formulario (A) que abre una confirmación REAL (B) dentro de sí; «Descartar» cierra ambas a la vez.
  function Anidada() {
    const [a, setA] = useState(false);
    const [b, setB] = useState(false);
    return (
      <>
        <main id="contenido" tabIndex={-1}>
          <button onClick={() => setA(true)}>Editar</button>
        </main>
        {a && (
          <Ventana titulo="Formulario" onEscape={() => setA(false)}>
            <input aria-label="campo" />
            <button onClick={() => setB(true)}>Descartar cambios</button>
            {b && (
              <ConfirmModal
                title="¿Descartar?"
                message="Se perderán los cambios"
                confirmText="Descartar"
                onConfirm={() => { setA(false); setB(false); }}
                onCancel={() => setB(false)}
              />
            )}
          </Ventana>
        )}
      </>
    );
  }

  function abrirConfirmacion() {
    render(<Anidada />);
    const editar = screen.getByRole('button', { name: 'Editar' });
    editar.focus();
    fireEvent.click(editar);
    const descartar = screen.getByRole('button', { name: 'Descartar cambios' });
    descartar.focus();
    fireEvent.click(descartar);
    expect(screen.getByRole('alertdialog', { name: '¿Descartar?' })).toBeTruthy();
    return { editar, descartar };
  }

  it('al cerrar ambas a la vez, el foco vuelve al origen de la primera', () => {
    const { editar } = abrirConfirmacion();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(editar);
  });

  it('al cerrar solo la superior, el foco vuelve dentro de la inferior', () => {
    const { descartar } = abrirConfirmacion();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(descartar);
  });
});

describe('getFocusable: controles que no reciben foco', () => {
  function montar(html: string) {
    const raiz = document.createElement('div');
    // DOMParser (y no innerHTML): HTML de ejemplo fijo de la prueba, sin asignar HTML dinámico al DOM.
    const doc = new DOMParser().parseFromString(html, 'text/html');
    raiz.append(...Array.from(doc.body.childNodes));
    document.body.appendChild(raiz);
    return raiz;
  }

  it('excluye los controles dentro de un fieldset deshabilitado, salvo su primer legend', () => {
    const raiz = montar(
      '<fieldset disabled><legend><button id="leg">leg</button></legend><button id="dentro">x</button></fieldset><button id="libre">y</button>',
    );
    expect(getFocusable(raiz).map(e => e.id)).toEqual(['leg', 'libre']);
    raiz.remove();
  });

  it('excluye los radios no marcados cuando el grupo tiene uno marcado', () => {
    const raiz = montar(
      '<input type="radio" name="g" id="r1"><input type="radio" name="g" id="r2" checked><input type="radio" name="g" id="r3">' +
        '<input type="radio" name="h" id="h1"><input type="radio" name="h" id="h2">',
    );
    expect(getFocusable(raiz).map(e => e.id)).toEqual(['r2', 'h1', 'h2']);
    raiz.remove();
  });

  it('excluye los controles que checkVisibility reporta invisibles', () => {
    const raiz = montar('<button id="visible">a</button><button id="oculto" data-oculto>b</button>');
    const proto = Element.prototype as unknown as { checkVisibility?: () => boolean };
    const original = proto.checkVisibility;
    proto.checkVisibility = function (this: HTMLElement) {
      return !this.hasAttribute('data-oculto');
    };
    try {
      expect(getFocusable(raiz).map(e => e.id)).toEqual(['visible']);
    } finally {
      if (original) proto.checkVisibility = original;
      else delete proto.checkVisibility;
      raiz.remove();
    }
  });
});

describe('ventanas de lectura y confirmación', () => {
  it('ConfirmModal de confirmación: alertdialog, foco en «Cancelar» y Escape cancela', () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(<ConfirmModal title="Borrar registro" message="¿Seguro?" onConfirm={onConfirm} onCancel={onCancel} />);
    const d = screen.getByRole('alertdialog', { name: 'Borrar registro' });
    expect(d.getAttribute('aria-describedby')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('ConfirmModal de solo aviso: el foco inicial va a «Entendido»', () => {
    render(<ConfirmModal title="Aviso" message="Texto" onCancel={() => {}} isAlertOnly />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Entendido' }));
  });

  it('DetailsModal: nombre accesible, «×» con nombre y Escape cierra', () => {
    const onClose = vi.fn();
    render(<DetailsModal record={{ id: 'a', Campo: 'valor' }} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Detalles del Registro' })).toBeTruthy();
    const botones = screen.getAllByRole('button', { name: 'Cerrar' });
    expect(botones).toHaveLength(2);
    expect(document.activeElement).toBe(botones[0]);
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('DetailsModal sin registro no se muestra', () => {
    render(<DetailsModal record={null} onClose={() => {}} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('CompaniaModal: nombre accesible y foco en «Cerrar»', () => {
    render(<CompaniaModal compania={{ 'Sigla Compañía': 'JG' }} onClose={() => {}} />);
    expect(screen.getByRole('dialog', { name: 'Detalle de Compañía' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar' }));
  });

  it('DocumentModal: nombre accesible y Escape cierra', async () => {
    const onClose = vi.fn();
    render(<DocumentModal documentCode="D-1" onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Documento D-1' })).toBeTruthy();
    await screen.findByText(/No se encontró información/);
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('TransactionModal: nombre accesible y Escape cierra', async () => {
    const onClose = vi.fn();
    render(<TransactionModal transactionCode={7} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Detalle de Transacción 7' })).toBeTruthy();
    await screen.findByText(/No se encontró información/);
    fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
