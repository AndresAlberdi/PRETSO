import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import GenericCreateModal from '../components/GenericCreateModal';

const colecciones: Record<string, any[]> = {
  bibliografia: [],
  documentos: [{ id: 'd1', Doc: 4, Documento: 'x' }],
  companias: [{ id: 'c1', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', Autores: 'Alarcón' }],
  transacciones: [{ id: 't1', Num: 3, Noticia: 'Pago' }],
  manejo_de_caja: [], salarios: [], indicadores: [], corpus_christi: [],
};

const setDoc = vi.hoisted(() => vi.fn());
const getDocs = vi.hoisted(() => vi.fn());
const logAction = vi.hoisted(() => vi.fn());
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: (...a: unknown[]) => logAction(...a) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (c: string) => c,
  doc: (coleccion: string) => ({ id: 'nuevo', coleccion }),
  setDoc: (...a: unknown[]) => setDoc(...a),
  getDocs: (nombre: string) => getDocs(nombre),
}));

beforeEach(() => {
  setDoc.mockReset().mockResolvedValue(undefined);
  getDocs.mockReset().mockImplementation(async (nombre: string) => ({
    docs: colecciones[nombre].map(d => ({ id: d.id, data: () => d })),
  }));
  logAction.mockReset().mockResolvedValue(undefined);
});
afterEach(cleanup);

async function abrirAlta(coleccion: string) {
  render(<GenericCreateModal collectionName={coleccion} onClose={() => undefined} onCreated={() => undefined} />);
  await waitFor(() => expect(screen.queryByText('Cargando opciones...')).toBeNull());
  return document.querySelector('form') as HTMLFormElement;
}

describe('errores del alta anunciados y enlazados', () => {
  it('bibliografía: el error se anuncia, marca Autores y se limpia al corregir', async () => {
    const form = await abrirAlta('bibliografia');
    const autores = screen.getByPlaceholderText('Autores del documento...');
    const referencias = screen.getByPlaceholderText('Detalles bibliográficos...');
    fireEvent.change(autores, { target: { value: '  ' } });
    fireEvent.change(referencias, { target: { value: 'Ref 1' } });
    fireEvent.submit(form);
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toBe("Debe completar el campo 'Autores'.");
    expect(autores.getAttribute('aria-invalid')).toBe('true');
    expect(autores.getAttribute('aria-describedby')).toBe(alerta.id);
    expect(referencias.hasAttribute('aria-invalid')).toBe(false);
    fireEvent.change(autores, { target: { value: 'Ana' } });
    fireEvent.submit(form);
    await waitFor(() => expect(setDoc).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).toBeNull();
    expect(document.querySelector('[aria-invalid]')).toBeNull();
  });

  it('transacciones sin documentos: solo el primer documento queda inválido', async () => {
    const form = await abrirAlta('transacciones');
    fireEvent.submit(form);
    await screen.findByRole('alert');
    expect(screen.getByLabelText('Documento 1').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByLabelText('Documento 2').hasAttribute('aria-invalid')).toBe(false);
  });

  it('remuneraciones sin compañía: el selector de compañía queda inválido', async () => {
    const form = await abrirAlta('salarios');
    fireEvent.change(screen.getByLabelText(/Transacción Relacionada/), { target: { value: '3' } });
    fireEvent.submit(form);
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toBe('Debe elegir una compañía existente.');
    const selector = screen.getByLabelText(/Sigla Compañía \(Obligatorio\)/);
    expect(selector.getAttribute('aria-invalid')).toBe('true');
    expect(selector.getAttribute('aria-describedby')).toBe(alerta.id);
  });

  it('un error posterior a la escritura se anuncia sin marcar campos', async () => {
    logAction.mockRejectedValue(new Error('auditoría caída'));
    const form = await abrirAlta('bibliografia');
    fireEvent.change(screen.getByPlaceholderText('Autores del documento...'), { target: { value: 'Ana' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles bibliográficos...'), { target: { value: 'Ref 1' } });
    fireEvent.submit(form);
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toBe('El registro ya se guardó; ciérrelo con «Cerrar».');
    expect(document.querySelectorAll('[aria-invalid="true"]').length).toBe(0);
  });

  it('un fallo al cargar los datos se anuncia sin marcar campos', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    getDocs.mockRejectedValue(new Error('sin red'));
    await abrirAlta('bibliografia');
    const alerta = await screen.findByRole('alert');
    expect(alerta.textContent).toBe('Error al cargar los datos del formulario.');
    expect(document.querySelectorAll('[aria-invalid="true"]').length).toBe(0);
  });

  it('un error de validación marca el campo y uno posterior a la escritura lo desmarca', async () => {
    logAction.mockRejectedValue(new Error('auditoría caída'));
    const form = await abrirAlta('bibliografia');
    const autores = screen.getByPlaceholderText('Autores del documento...');
    fireEvent.change(autores, { target: { value: ' ' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles bibliográficos...'), { target: { value: 'Ref 1' } });
    fireEvent.submit(form);
    await screen.findByRole('alert');
    expect(autores.getAttribute('aria-invalid')).toBe('true');
    fireEvent.change(autores, { target: { value: 'Ana' } });
    fireEvent.submit(form);
    await waitFor(() => expect(screen.getByRole('alert').textContent).toBe('El registro ya se guardó; ciérrelo con «Cerrar».'));
    expect(document.querySelectorAll('[aria-invalid="true"]').length).toBe(0);
  });
});

// Una fila por cada clave de ValidationError: colección, preparación que deja solo ese campo inválido,
// y el control que debe quedar marcado.
const porNombre = (rol: string, nombre: string | RegExp) => () => screen.getByRole(rol, { name: nombre });
const casos: Array<[string, string, string, () => void, () => HTMLElement]> = [
  ['Doc', 'transacciones', 'sin documentos', () => undefined, () => screen.getByLabelText('Documento 1')],
  ['Categorías', 'indicadores', 'sin categoría', () => undefined, porNombre('textbox', 'Categoría / Indicador (Obligatorio)')],
  ['Transacción', 'indicadores', 'sin transacción', () => {
    fireEvent.change(screen.getByPlaceholderText('Nombre de la nueva categoría'), { target: { value: 'Pagos' } });
  }, () => screen.getByLabelText(/Transacción Relacionada/)],
  ['Ciudad', 'corpus_christi', 'sin ciudad', () => undefined, porNombre('textbox', 'Ciudad (Obligatorio)')],
  ['Año', 'corpus_christi', 'sin año', () => {
    fireEvent.change(screen.getByPlaceholderText('Nombre de la nueva ciudad'), { target: { value: 'Potosí' } });
  }, porNombre('spinbutton', 'Año (Obligatorio)')],
  ['Transacción', 'corpus_christi', 'sin transacción', () => {
    fireEvent.change(screen.getByPlaceholderText('Nombre de la nueva ciudad'), { target: { value: 'Potosí' } });
    fireEvent.change(screen.getByPlaceholderText('Año (numérico)'), { target: { value: '1600' } });
  }, () => screen.getByLabelText(/Transacción Relacionada/)],
  ['Sigla Compañía', 'salarios', 'sin compañía', () => {
    fireEvent.change(screen.getByLabelText(/Transacción Relacionada/), { target: { value: '3' } });
  }, () => screen.getByLabelText(/Sigla Compañía \(Obligatorio\)/)],
  ['Transacción', 'salarios', 'sin transacción', () => {
    fireEvent.change(screen.getByLabelText(/Sigla Compañía \(Obligatorio\)/), { target: { value: '7' } });
  }, () => screen.getByLabelText(/Transacción Relacionada/)],
  ['Sigla Compañía', 'manejo_de_caja', 'sin compañía', () => {
    fireEvent.change(screen.getByLabelText(/Transacción Relacionada/), { target: { value: '3' } });
  }, () => screen.getByLabelText(/Sigla Compañía \(Obligatorio\)/)],
  ['Transacción', 'manejo_de_caja', 'sin transacción', () => {
    fireEvent.change(screen.getByLabelText(/Sigla Compañía \(Obligatorio\)/), { target: { value: '7' } });
  }, () => screen.getByLabelText(/Transacción Relacionada/)],
  ['Sigla Compañía', 'companias', 'sigla duplicada', () => {
    fireEvent.change(screen.getByPlaceholderText('Ej: GA-JR'), { target: { value: 'ga-jr' } });
  }, () => screen.getByPlaceholderText('Ej: GA-JR')],
  ['Autores', 'bibliografia', 'sin autores', () => {
    fireEvent.change(screen.getByPlaceholderText('Detalles bibliográficos...'), { target: { value: 'Ref' } });
  }, () => screen.getByPlaceholderText('Autores del documento...')],
  ['Referencias bibliográficas', 'bibliografia', 'sin referencias', () => {
    fireEvent.change(screen.getByPlaceholderText('Autores del documento...'), { target: { value: 'Ana' } });
  }, () => screen.getByPlaceholderText('Detalles bibliográficos...')],
];

describe('cada clave de ValidationError marca su control', () => {
  it.each(casos)('%s en %s (%s)', async (_campo, coleccion, _caso, preparar, control) => {
    const form = await abrirAlta(coleccion);
    preparar();
    fireEvent.submit(form);
    const alerta = await screen.findByRole('alert');
    const marcados = Array.from(document.querySelectorAll('[aria-invalid="true"]'));
    expect(marcados).toEqual([control()]);
    expect(control().getAttribute('aria-describedby')).toBe(alerta.id);
  });
});
