import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import GenericCreateModal from '../components/GenericCreateModal';
import GenericEditModal from '../components/GenericEditModal';
import SearchBar from '../components/SearchBar';

const colecciones: Record<string, any[]> = {
  companias: [{ id: 'c1', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', Autores: 'Alarcón' }],
  transacciones: [{ id: 't1', Num: 3, Noticia: 'Pago' }],
  documentos: [{ id: 'd1', Doc: 1, Documento: 'Escritura' }],
  manejo_de_caja: [], salarios: [], indicadores: [], bibliografia: [],
  corpus_christi: [{ id: 'k0', 'Indicador de registro': 2, Ciudad: 'Potosí', 'Año': 1600 }],
};

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (c: string) => c,
  doc: (coleccion: string) => ({ id: 'nuevo', coleccion }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  getDocs: async (nombre: string) => ({
    docs: colecciones[nombre].map(d => ({ id: d.id, data: () => d })),
  }),
}));

afterEach(cleanup);

// Cantidad real de controles de texto por colección en el alta.
const ESPERADOS: Record<string, number> = {
  documentos: 1, transacciones: 2, companias: 5, bibliografia: 2,
  manejo_de_caja: 5, salarios: 4, corpus_christi: 5, indicadores: 6,
};

describe('alta: corrector ortográfico en los campos de texto', () => {
  beforeEach(() => undefined);
  for (const c of Object.keys(ESPERADOS)) {
    it(`${c}: todo campo de texto lleva corrector, salvo la sigla`, async () => {
      render(<GenericCreateModal collectionName={c} onClose={vi.fn()} onCreated={vi.fn()} />);
      await screen.findByRole('button', { name: 'Crear Registro' });
      if (c === 'corpus_christi') fireEvent.click(screen.getByLabelText('Nueva ciudad'));
      const campos = document.body.querySelectorAll<HTMLElement>('textarea, input[type="text"]');
      expect(campos.length).toBe(ESPERADOS[c]);
      campos.forEach(el => {
        if (el.getAttribute('placeholder') === 'Ej: GA-JR') {
          expect(el.getAttribute('spellcheck')).toBe('false');
          expect(el.hasAttribute('lang')).toBe(false);
        } else {
          expect(el.getAttribute('spellcheck'), el.outerHTML).toBe('true');
          expect(el.getAttribute('lang'), el.outerHTML).toBe('es');
        }
      });
    });
  }
});

function editar(coleccion: string, record: any) {
  render(<GenericEditModal collectionName={coleccion} record={record} onSave={vi.fn()} onClose={vi.fn()} />);
  return screen.findByRole('dialog', { name: /Editar Registro/ });
}

function libre(el: HTMLElement) {
  expect(el.getAttribute('spellcheck')).toBe('true');
  expect(el.getAttribute('lang')).toBe('es');
}

function codigo(el: HTMLElement) {
  expect(el.getAttribute('spellcheck')).toBe('false');
}

describe('edición: corrector ortográfico según el tipo de campo', () => {
  it('companias: Autores y Ámbito con corrector; sigla e indicador sin él', async () => {
    await editar('companias', { id: 'c1', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', Autores: 'Alarcón', 'Ámbito': 'España' });
    libre(screen.getByLabelText('Autores'));
    libre(screen.getByLabelText('Ámbito'));
    codigo(screen.getByLabelText(/^Compañía/));
    codigo(screen.getByLabelText(/Indicador de registro/));
  });

  it('transacciones: Noticia y Fuentes con corrector; Nro. sin él', async () => {
    await editar('transacciones', { id: 't1', Num: 3, Noticia: 'Pago', 'Fuentes para la generación del dato': 'AGI', Doc1: 1 });
    libre(screen.getByLabelText('Noticia'));
    libre(screen.getByLabelText('Fuentes para la generación del dato'));
    codigo(screen.getByLabelText(/^Nro\./));
    const doc1 = screen.getByLabelText('Doc1');
    expect(doc1.tagName).toBe('SELECT');
    expect(doc1.hasAttribute('spellcheck')).toBe(false);
  });

  it('salarios: Beneficiario con corrector; Año y Transacción sin él', async () => {
    await editar('salarios', { id: 's1', 'Indicador de registro': 1, 'Beneficiario ': 'Juan', 'Año': 1600, 'Sigla Compañía': 7, 'Transacción': 3 });
    libre(screen.getByLabelText('Beneficiario'));
    codigo(screen.getByLabelText('Año'));
    codigo(screen.getByLabelText('Transacción'));
  });
});

describe('buscador: corrector ortográfico', () => {
  it('SearchBar: «Añadir filtro» con corrector', () => {
    render(<SearchBar categories={[{ id: 'todo', label: 'Texto libre' }]} onSearch={() => undefined} />);
    libre(screen.getByRole('textbox', { name: 'Añadir filtro' }));
  });
});
