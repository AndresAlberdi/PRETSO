import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  where: vi.fn(),
  getDocs: async (nombre: string) => ({
    empty: false,
    docs: [{
      id: 'x',
      data: () => nombre === 'transacciones'
        ? { Num: 1, Noticia: 'Pago a Alberto', 'Fuentes para la generación del dato': 'ALP', Doc1: 5 }
        : { Doc: 5, Documento: 'Carta de Alberto' },
    }],
  }),
}));

import TransactionModal from '../components/TransactionModal';
import DocumentModal from '../components/DocumentModal';
import CompaniaModal from '../components/CompaniaModal';

afterEach(cleanup);
const marcas = () => [...document.querySelectorAll('mark.coincidencia')].map(m => m.textContent);

describe('modales con término', () => {
  it('TransactionModal marca Noticia y la descripción del documento', async () => {
    render(<TransactionModal transactionCode={1} termino="alberto" onClose={vi.fn()} />);
    await screen.findByText('Información general');
    expect(marcas()).toEqual(['Alberto', 'Alberto']);
  });

  it('TransactionModal sin término no marca nada', async () => {
    render(<TransactionModal transactionCode={1} onClose={vi.fn()} />);
    await screen.findByText('Información general');
    expect(marcas()).toEqual([]);
    expect(screen.getByText(/Pago a Alberto/)).toBeTruthy();
  });

  it('DocumentModal marca el texto del documento', async () => {
    render(<DocumentModal documentCode={5} termino="alberto" onClose={vi.fn()} />);
    await screen.findByText(/Carta de/);
    expect(marcas()).toEqual(['Alberto']);
  });

  it('DocumentModal sin término no marca nada', async () => {
    render(<DocumentModal documentCode={5} onClose={vi.fn()} />);
    await screen.findByText('Carta de Alberto');
    expect(marcas()).toEqual([]);
  });

  it('CompaniaModal marca valores y trata Temporadas teatrales como año', () => {
    const compania = { id: 'c', 'Indicador de registro': 1, 'Nombre Compañía': 'Compañía de Alberto', 'Temporadas teatrales': 'De 1580 a 1581' };
    const { unmount } = render(<CompaniaModal compania={compania} termino="alberto" onClose={vi.fn()} />);
    expect(marcas()).toEqual(['Alberto']);
    unmount();
    render(<CompaniaModal compania={compania} termino="1581" onClose={vi.fn()} />);
    expect(marcas()).toEqual(['De 1580 a 1581']);
  });

  it('CompaniaModal sin término no marca nada', () => {
    render(<CompaniaModal compania={{ id: 'c', 'Nombre Compañía': 'Alberto' }} onClose={vi.fn()} />);
    expect(marcas()).toEqual([]);
  });
});
