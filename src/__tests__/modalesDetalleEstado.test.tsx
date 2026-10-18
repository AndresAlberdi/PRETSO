import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import CompaniaModal from '../components/CompaniaModal';
import DocumentModal from '../components/DocumentModal';
import TransactionModal from '../components/TransactionModal';

const resultado = vi.hoisted(() => ({ docs: [] as any[] }));

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(), where: vi.fn(), query: vi.fn(),
  getDocs: async () => ({
    empty: resultado.docs.length === 0,
    docs: resultado.docs.map(d => ({ data: () => d })),
  }),
}));

beforeEach(() => { resultado.docs = []; });
afterEach(cleanup);

const modales: [string, () => React.ReactElement, any, string][] = [
  ['TransactionModal', () => <TransactionModal transactionCode={7} onClose={vi.fn()} />, { Num: 7, Noticia: 'Noticia de prueba' }, 'Noticia de prueba'],
  ['DocumentModal', () => <DocumentModal documentCode="D-1" onClose={vi.fn()} />, { Doc: 'D-1', Documento: 'Texto del documento' }, 'Texto del documento'],
  ['CompaniaModal', () => <CompaniaModal sigla="X" onClose={vi.fn()} />, { 'Sigla Compañía': 'X', Autores: 'Autor de prueba' }, 'Autor de prueba'],
];

describe.each(modales)('%s: estado anunciado', (_n, crear, datos, textoContenido) => {
  it('sin datos, el estado persistente contiene «No se encontró información» y es el único', async () => {
    render(crear());
    const estado = screen.getByRole('status');
    expect(within(estado).getByText(/Cargando/)).toBeTruthy();
    await screen.findByText(/No se encontró información/);
    expect(screen.getByRole('status')).toBe(estado);
    expect(within(estado).getByText(/No se encontró información/)).toBeTruthy();
    expect(screen.getAllByText(/No se encontró información/).length).toBe(1);
  });

  it('con datos, el estado queda vacío y se ve el contenido', async () => {
    resultado.docs = [datos];
    render(crear());
    await screen.findByText(textoContenido);
    expect(screen.getByRole('status').textContent).toBe('');
    expect(screen.queryByText(/No se encontró información/)).toBeNull();
  });
});
