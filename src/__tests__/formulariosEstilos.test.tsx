import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import GenericCreateModal from '../components/GenericCreateModal';
import GenericEditModal from '../components/GenericEditModal';

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (c: string) => c,
  addDoc: vi.fn(),
  getDocs: async () => ({ docs: [] }),
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

describe('caracterización de los estilos de los formularios modales', () => {
  it('GenericCreateModal (bibliografía)', async () => {
    render(<GenericCreateModal collectionName="bibliografia" onClose={() => {}} onCreated={() => {}} />);
    await waitFor(() => expect(screen.queryByText('Cargando opciones...')).toBeNull());
    expect(capas('Nuevo Registro - BIBLIOGRAFÍA')).toMatchInlineSnapshot(`
      {
        "overlay": "position: fixed; top: 0px; left: 0px; right: 0px; bottom: 0px; background-color: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 2000;",
        "panel": "background: var(--bg-card); padding: 2.5rem; border-radius: 12px; max-width: 700px; width: 90%; max-height: 90vh; overflow-y: auto; border: 1px solid var(--border-color); box-shadow: 0 8px 32px rgba(0,0,0,0.3);",
      }
    `);
  });

  it('GenericEditModal', () => {
    render(
      <GenericEditModal
        collectionName="bibliografia"
        record={{ id: 'b1', Autores: 'Autor' }}
        onSave={async () => {}}
        onClose={() => {}}
      />,
    );
    expect(capas('Editar Registro - BIBLIOGRAFÍA')).toMatchInlineSnapshot(`
      {
        "overlay": "position: fixed; top: 0px; left: 0px; right: 0px; bottom: 0px; background-color: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; z-index: 2000;",
        "panel": "background: var(--bg-card); padding: 2rem; border-radius: 12px; max-width: 600px; width: 90%; max-height: 90vh; overflow-y: auto; border: 1px solid var(--border-color); box-shadow: 0 8px 32px rgba(0,0,0,0.3);",
      }
    `);
  });
});
