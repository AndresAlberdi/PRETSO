import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import SearchBar from '../components/SearchBar';
import SelectorCompania from '../components/SelectorCompania';

vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (c: string) => c,
  doc: (coleccion: string) => ({ id: 'nuevo', coleccion }),
  setDoc: vi.fn().mockResolvedValue(undefined),
  getDocs: async () => ({ docs: [] }),
}));

beforeEach(() => undefined);
afterEach(cleanup);

// Controles de formulario sin ningún nombre accesible (etiqueta, aria-label o aria-labelledby).
function sinNombre(root: ParentNode = document): Element[] {
  return Array.from(root.querySelectorAll('input, select, textarea')).filter(el => {
    const control = el as HTMLInputElement;
    if (control.type === 'hidden') return false;
    return !(control.labels && control.labels.length)
      && !el.getAttribute('aria-label')
      && !el.getAttribute('aria-labelledby');
  });
}

// Atributos for / aria-labelledby / aria-describedby cuyo id no resuelve a ningún elemento.
function referenciasRotas(root: ParentNode = document): string[] {
  const rotas: string[] = [];
  root.querySelectorAll('[for], [aria-labelledby], [aria-describedby]').forEach(el => {
    const ids = [el.getAttribute('for'), el.getAttribute('aria-labelledby'), el.getAttribute('aria-describedby')]
      .filter((v): v is string => !!v)
      .flatMap(v => v.split(/\s+/));
    ids.forEach(id => { if (!document.getElementById(id)) rotas.push(id); });
  });
  return rotas;
}

function idsRepetidos(): string[] {
  const vistos = new Set<string>();
  const repetidos = new Set<string>();
  document.querySelectorAll('[id]').forEach(el => {
    if (vistos.has(el.id)) repetidos.add(el.id);
    vistos.add(el.id);
  });
  return Array.from(repetidos);
}

// Evita que las utilidades queden sin uso en pasos posteriores.
void sinNombre; void referenciasRotas; void waitFor;

describe('SearchBar con nombres accesibles', () => {
  const categorias = [{ id: 'todo', label: 'Texto libre' }, { id: 'autor', label: 'Autor' }];

  it('el selector, el campo y el botón de quitar filtro tienen nombre', () => {
    render(<SearchBar categories={categorias} onSearch={() => undefined} />);
    expect(screen.getByRole('combobox', { name: 'Buscar en' })).toBeTruthy();
    const campo = screen.getByRole('textbox', { name: 'Añadir filtro' });
    fireEvent.change(campo, { target: { value: 'garcia' } });
    fireEvent.submit(campo.closest('form') as HTMLFormElement);
    expect(screen.getByRole('button', { name: 'Quitar filtro Texto libre: garcia' })).toBeTruthy();
  });

  it('dos buscadores no repiten ids', () => {
    render(<><SearchBar categories={categorias} onSearch={() => undefined} /><SearchBar categories={categorias} onSearch={() => undefined} /></>);
    expect(idsRepetidos()).toEqual([]);
  });
});

describe('SelectorCompania con error', () => {
  it('expone aria-invalid y aria-describedby cuando se piden', () => {
    render(<SelectorCompania companias={[]} value={null} onChange={() => undefined} ariaLabel="Compañía" ariaInvalid ariaDescribedBy="x" />);
    const s = screen.getByRole('combobox', { name: 'Compañía' });
    expect(s.getAttribute('aria-invalid')).toBe('true');
    expect(s.getAttribute('aria-describedby')).toBe('x');
  });

  it('sin las props no añade atributos', () => {
    render(<SelectorCompania companias={[]} value={null} onChange={() => undefined} ariaLabel="Compañía" />);
    const s = screen.getByRole('combobox', { name: 'Compañía' });
    expect(s.hasAttribute('aria-invalid')).toBe(false);
    expect(s.hasAttribute('aria-describedby')).toBe(false);
  });
});
