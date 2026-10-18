import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import ConfirmModal from '../components/ConfirmModal';
import DetailsModal from '../components/DetailsModal';
import DocumentModal from '../components/DocumentModal';
import TransactionModal from '../components/TransactionModal';
import CompaniaModal from '../components/CompaniaModal';

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  where: (campo: string, op: string, valor: unknown) => ({ campo, op, valor }),
  query: (nombre: string, ...filtros: unknown[]) => ({ nombre, filtros }),
  getDocs: async () => ({ empty: true, docs: [] }),
}));

afterEach(cleanup);

// Sube desde el texto hasta el fondo (position: fixed) y devuelve el fondo y el panel.
function capas(texto: string) {
  let panel: HTMLElement = screen.getByText(texto);
  while (panel.parentElement && panel.parentElement.style.position !== 'fixed') {
    panel = panel.parentElement;
  }
  const overlay = panel.parentElement as HTMLElement;
  expect(overlay.style.position).toBe('fixed');
  return { overlay: overlay.style.cssText, panel: panel.style.cssText };
}

describe('caracterización de los estilos de las ventanas modales', () => {
  it('ConfirmModal de confirmación', () => {
    render(<ConfirmModal title="Confirmar borrado" message="Mensaje" onConfirm={() => {}} onCancel={() => {}} />);
    expect(capas('Confirmar borrado')).toMatchInlineSnapshot(`
      {
        "overlay": "position: fixed; top: 0px; left: 0px; right: 0px; bottom: 0px; background-color: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;",
        "panel": "background: var(--bg-card); padding: 2rem; border-radius: 8px; max-width: 500px; width: 90%; box-shadow: 0 4px 12px rgba(0,0,0,0.15);",
      }
    `);
  });

  it('ConfirmModal de solo aviso', () => {
    render(<ConfirmModal title="Aviso" message="Mensaje" onCancel={() => {}} isAlertOnly />);
    expect(capas('Aviso')).toMatchInlineSnapshot(`
      {
        "overlay": "position: fixed; top: 0px; left: 0px; right: 0px; bottom: 0px; background-color: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;",
        "panel": "background: var(--bg-card); padding: 2rem; border-radius: 8px; max-width: 500px; width: 90%; box-shadow: 0 4px 12px rgba(0,0,0,0.15);",
      }
    `);
  });

  it('DetailsModal', () => {
    render(<DetailsModal record={{ id: 'a', Campo: 'valor' }} onClose={() => {}} />);
    expect(capas('Detalles del Registro')).toMatchInlineSnapshot(`
      {
        "overlay": "position: fixed; top: 0px; left: 0px; right: 0px; bottom: 0px; background-color: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 1000;",
        "panel": "background: var(--bg-card); padding: 2rem; border-radius: 8px; width: 90%; max-width: 600px; max-height: 90vh; overflow-y: auto; box-shadow: 0 4px 12px rgba(0,0,0,0.15);",
      }
    `);
  });

  it('DocumentModal', () => {
    render(<DocumentModal documentCode="D1" onClose={() => {}} />);
    expect(capas('Documento D1')).toMatchInlineSnapshot(`
      {
        "overlay": "position: fixed; top: 0px; left: 0px; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.7); z-index: 9999; display: flex; align-items: center; justify-content: center;",
        "panel": "background: var(--bg-card); padding: 2rem; border-radius: 12px; width: 90%; max-width: 800px; max-height: 90vh; overflow-y: auto; border: 1px solid var(--border-color); box-shadow: 0 8px 32px rgba(0,0,0,0.5);",
      }
    `);
  });

  it('TransactionModal', () => {
    render(<TransactionModal transactionCode={5} onClose={() => {}} />);
    expect(capas('Detalle de Transacción 5')).toMatchInlineSnapshot(`
      {
        "overlay": "position: fixed; top: 0px; left: 0px; width: 100vw; height: 100vh; background: rgba(0, 0, 0, 0.7); z-index: 9999; display: flex; align-items: center; justify-content: center;",
        "panel": "background: var(--bg-card); padding: 2rem; border-radius: 12px; width: 90%; max-width: 800px; max-height: 90vh; overflow-y: auto; border: 1px solid var(--border-color); box-shadow: 0 8px 32px rgba(0,0,0,0.5);",
      }
    `);
  });

  it('CompaniaModal con la compañía ya resuelta', () => {
    render(<CompaniaModal compania={{ 'Sigla Compañía': 'JG' }} onClose={() => {}} />);
    expect(capas('Detalle de Compañía')).toMatchInlineSnapshot(`
      {
        "overlay": "position: fixed; top: 0px; left: 0px; right: 0px; bottom: 0px; background-color: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 1000;",
        "panel": "background: var(--bg-color); padding: 2rem; border-radius: 1rem; max-width: 800px; width: 90%; max-height: 90vh; overflow-y: auto; box-shadow: 0 20px 40px rgba(0,0,0,0.5);",
      }
    `);
  });
});
