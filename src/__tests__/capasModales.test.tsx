import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import BusyModal from '../components/BusyModal';
import IndiceCompanias from '../pages/IndiceCompanias';

const companias = [
  { id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', Autores: 'Alarcón' },
];
let colecciones: Record<string, any[]> = {};
const fallo = vi.hoisted(() => ({ coleccion: null as string | null }));

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
}));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isEditMode: true }) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  where: (campo: string, op: string, valor: unknown) => ({ campo, op, valor }),
  query: (nombre: string, ...filtros: any[]) => ({ nombre, filtros }),
  doc: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), addDoc: vi.fn(),
  getDocs: async (q: string | { nombre: string; filtros: any[] }) => {
    const nombre = typeof q === 'string' ? q : q.nombre;
    if (fallo.coleccion === nombre) throw new Error('fallo simulado de lectura');
    const filtros = typeof q === 'string' ? [] : q.filtros;
    const docs = (colecciones[nombre] ?? []).filter(d => filtros.every(f => d[f.campo] === f.valor));
    return { empty: docs.length === 0, size: docs.length, docs: docs.map(d => ({ id: d.id, data: () => d })) };
  },
}));

beforeEach(() => {
  fallo.coleccion = null;
  colecciones = { companias, manejo_de_caja: [], salarios: [], corpus_christi: [], indicadores: [] };
});
afterEach(cleanup);

describe('BusyModal', () => {
  it('es un diálogo ocupado con nombre y descripción, y el foco queda en el panel', () => {
    render(<BusyModal />);
    const d = screen.getByRole('dialog', { name: 'Por favor espere' });
    expect(d.getAttribute('aria-busy')).toBe('true');
    expect(d.getAttribute('aria-modal')).toBe('true');
    expect(d.getAttribute('aria-describedby')).toBe(screen.getByText('Analizando registros...').id);
    expect(document.activeElement).toBe(d);
  });

  it('acepta título y mensaje propios', () => {
    render(<BusyModal title="Un título" message="Un mensaje" />);
    expect(screen.getByRole('dialog', { name: 'Un título' })).toBeTruthy();
    expect(screen.getByText('Un mensaje')).toBeTruthy();
  });

  it('Escape NO la cierra', () => {
    render(<BusyModal />);
    // fireEvent devuelve false si algún manejador llamó a preventDefault: Escape no debe ser atendido.
    const sinAtender = fireEvent.keyDown(document.activeElement as Element, { key: 'Escape' });
    expect(sinAtender).toBe(true);
    expect(screen.getByRole('dialog', { name: 'Por favor espere' })).toBeTruthy();
  });
});

describe('capa de espera en IndiceCompanias', () => {
  async function pulsarBorrar() {
    render(<StrictMode><IndiceCompanias /></StrictMode>);
    const fila = (await screen.findByText('GA-JR')).closest('tr') as HTMLElement;
    const borrar = Array.from(fila.querySelectorAll('button')).find(b => b.textContent === 'Borrar')!;
    borrar.focus();
    fireEvent.click(borrar);
    return borrar;
  }

  it('el foco pasa a la capa, luego a «Cancelar» de la confirmación y al cancelar vuelve a «Borrar»', async () => {
    const borrar = await pulsarBorrar();
    const capa = await screen.findByRole('dialog', { name: 'Por favor espere' });
    expect(document.activeElement).toBe(capa);
    const confirmacion = await screen.findByRole('alertdialog', { name: 'Confirmar Borrado' }, { timeout: 4000 });
    expect(screen.queryByRole('dialog', { name: 'Por favor espere' })).toBeNull();
    const cancelar = Array.from(confirmacion.querySelectorAll('button')).find(b => b.textContent === 'Cancelar')!;
    expect(document.activeElement).toBe(cancelar);
    fireEvent.click(cancelar);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(borrar);
  });

  it('con la lectura fallida la capa de espera desaparece y queda el aviso', async () => {
    fallo.coleccion = 'corpus_christi';
    await pulsarBorrar();
    await screen.findByRole('dialog', { name: 'Por favor espere' });
    const aviso = await screen.findByRole('alertdialog', {}, { timeout: 4000 });
    expect(aviso.textContent).toMatch(/No se pudo verificar/);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Por favor espere' })).toBeNull());
  });
});
