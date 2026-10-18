import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import SearchBar from '../components/SearchBar';
import SelectorCompania from '../components/SelectorCompania';
import GenericCreateModal from '../components/GenericCreateModal';
import GenericEditModal from '../components/GenericEditModal';

const colecciones: Record<string, any[]> = {
  companias: [{ id: 'c1', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', Autores: 'Alarcón' }],
  transacciones: [{ id: 't1', Num: 3, Noticia: 'Pago' }],
  documentos: [{ id: 'd1', Doc: 1, Documento: 'Escritura' }],
  manejo_de_caja: [], salarios: [], bibliografia: [],
  indicadores: [{ id: 'i1', 'Categorías': 'Pagos' }],
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

async function abrirAlta(coleccion: string) {
  render(<GenericCreateModal collectionName={coleccion} onClose={() => undefined} onCreated={() => undefined} />);
  await waitFor(() => expect(screen.queryByText('Cargando opciones...')).toBeNull());
  return screen.getByRole('dialog');
}

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

describe('formularios de alta etiquetados', () => {
  it.each(['documentos', 'transacciones', 'companias', 'bibliografia', 'manejo_de_caja', 'salarios', 'corpus_christi', 'indicadores'])(
    'el alta de %s no deja controles sin nombre ni referencias rotas',
    async (coleccion) => {
      const dialogo = await abrirAlta(coleccion);
      expect(sinNombre(dialogo)).toEqual([]);
      expect(referenciasRotas(dialogo)).toEqual([]);
      expect(document.getElementById('selector-compania')).toBeNull();
    },
  );

  it('transacciones: cada documento tiene su etiqueta dentro de un grupo', async () => {
    await abrirAlta('transacciones');
    expect(screen.getByLabelText('Documento 1').tagName).toBe('SELECT');
    expect(screen.getByRole('group', { name: 'Asociar Documentos (Hasta 10)' })).toBeTruthy();
  });

  it('corpus: los grupos Ciudad y Año tienen radios con name propio y control con nombre de grupo', async () => {
    await abrirAlta('corpus_christi');
    expect(screen.getByRole('group', { name: 'Ciudad (Obligatorio)' })).toBeTruthy();
    expect(screen.getByRole('combobox', { name: 'Ciudad (Obligatorio)' })).toBeTruthy();
    const nombreCiudad = (screen.getByLabelText('Elegir previa') as HTMLInputElement).name;
    expect(nombreCiudad).not.toBe('');
    expect((screen.getByLabelText('Nueva ciudad') as HTMLInputElement).name).toBe(nombreCiudad);
    const nombreAnio = (screen.getByLabelText('Elegir previo') as HTMLInputElement).name;
    expect(nombreAnio).not.toBe('');
    expect((screen.getByLabelText('Nuevo año') as HTMLInputElement).name).toBe(nombreAnio);
    expect(nombreAnio).not.toBe(nombreCiudad);
    fireEvent.click(screen.getByLabelText('Nueva ciudad'));
    expect(screen.getByRole('textbox', { name: 'Ciudad (Obligatorio)' })).toBeTruthy();
  });

  it('dos altas de remuneraciones apiladas no repiten ids', async () => {
    render(<>
      <GenericCreateModal collectionName="salarios" onClose={() => undefined} onCreated={() => undefined} />
      <GenericCreateModal collectionName="salarios" onClose={() => undefined} onCreated={() => undefined} />
    </>);
    await waitFor(() => expect(screen.queryByText('Cargando opciones...')).toBeNull());
    expect(idsRepetidos()).toEqual([]);
  });
});

describe('formulario de edición etiquetado', () => {
  async function abrirEdicion(coleccion: string, record: any) {
    render(<GenericEditModal collectionName={coleccion} record={record} onSave={async () => undefined} onClose={() => undefined} />);
    await waitFor(() => expect(screen.getByRole('dialog')).toBeTruthy());
    // Espera a que carguen las compañías y documentos antes de inspeccionar.
    await waitFor(() => expect((screen.getByRole('button', { name: 'Guardar Cambios' }) as HTMLButtonElement).disabled).toBe(false));
    return screen.getByRole('dialog');
  }

  it('remuneraciones: cada etiqueta queda asociada a su campo', async () => {
    const dialogo = await abrirEdicion('salarios', { id: 'x', 'Indicador de registro': 3, 'Sigla Compañía': 7, 'Beneficiario ': 'Ana' });
    expect(screen.getByLabelText('Compañía').tagName).toBe('SELECT');
    expect((screen.getByLabelText('Indicador de registro (No Editable)') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Beneficiario') as HTMLInputElement).value).toBe('Ana');
    expect(sinNombre(dialogo)).toEqual([]);
    expect(referenciasRotas(dialogo)).toEqual([]);
  });

  it('transacciones: el campo Doc1 es un selector con etiqueta', async () => {
    await abrirEdicion('transacciones', { id: 't', Num: 3, Noticia: 'Pago', Doc1: 1 });
    expect(screen.getByLabelText('Doc1').tagName).toBe('SELECT');
  });
});
