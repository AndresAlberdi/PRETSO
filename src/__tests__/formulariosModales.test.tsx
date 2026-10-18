import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { useState } from 'react';
import type { ReactNode } from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import GenericCreateModal from '../components/GenericCreateModal';
import GenericEditModal from '../components/GenericEditModal';

const colecciones: Record<string, any[]> = {
  companias: [{ id: 'c1', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', Autores: 'Alarcón' },
    { id: 'c2', 'Indicador de registro': 12, 'Sigla Compañía': 'JG', Autores: 'Juan' },
  ],
  transacciones: [{ id: 't1', Num: 3, Noticia: 'Pago' }],
  documentos: [{ id: 'd1', Doc: 1, Documento: 'Escritura' }],
  manejo_de_caja: [], salarios: [], indicadores: [], bibliografia: [],
  corpus_christi: [{ id: 'k0', 'Indicador de registro': 2, Ciudad: 'Potosí', 'Año': 1600 }],
};

const addDoc = vi.hoisted(() => vi.fn());
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (c: string) => c,
  addDoc: (...a: unknown[]) => addDoc(...a),
  getDocs: async (nombre: string) => ({
    docs: colecciones[nombre].map(d => ({ id: d.id, data: () => d })),
  }),
}));

beforeEach(() => addDoc.mockReset().mockResolvedValue({ id: 'nuevo' }));
afterEach(cleanup);

// Arnés con el botón de origen y el contenedor principal, como en App.tsx.
function Arnes({ etiqueta, children }: { etiqueta: string; children: (cerrar: () => void) => ReactNode }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <main id="contenido" tabIndex={-1}>
        <button onClick={() => setAbierta(true)}>{etiqueta}</button>
      </main>
      {abierta && children(() => setAbierta(false))}
    </>
  );
}

function abrir(etiqueta: string) {
  const origen = screen.getByRole('button', { name: etiqueta });
  origen.focus();
  fireEvent.click(origen);
  return origen;
}

function escape() {
  fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
}

const registro = { id: 'b1', Autores: 'Autor', 'Referencias bibliográficas': 'Ref' };

async function abrirEdicion(opciones: { onSave?: () => Promise<void>; onClose?: () => void; coleccion?: string; record?: any } = {}) {
  const onClose = opciones.onClose ?? vi.fn();
  const onSave = opciones.onSave ?? vi.fn().mockResolvedValue(undefined);
  render(
    <Arnes etiqueta="Editar">
      {cerrar => (
        <GenericEditModal
          collectionName={opciones.coleccion ?? 'bibliografia'}
          record={opciones.record ?? registro}
          onSave={onSave}
          onClose={() => { onClose(); cerrar(); }}
        />
      )}
    </Arnes>,
  );
  const origen = abrir('Editar');
  await screen.findByRole('dialog', { name: /Editar Registro/ });
  return { origen, onClose, onSave };
}

async function abrirAlta(opciones: { coleccion?: string; onClose?: () => void } = {}) {
  const onClose = opciones.onClose ?? vi.fn();
  render(
    <Arnes etiqueta="Nuevo Registro">
      {cerrar => (
        <GenericCreateModal
          collectionName={opciones.coleccion ?? 'bibliografia'}
          onClose={() => { onClose(); cerrar(); }}
          onCreated={vi.fn()}
        />
      )}
    </Arnes>,
  );
  const origen = abrir('Nuevo Registro');
  await screen.findByRole('dialog', { name: /Nuevo Registro - / });
  await waitFor(() => expect(screen.queryByText('Cargando opciones...')).toBeNull());
  return { origen, onClose };
}

describe('GenericEditModal: accesibilidad', () => {
  it('es un diálogo con nombre accesible y el foco inicial va al primer campo editable', async () => {
    await abrirEdicion();
    expect(screen.getByRole('dialog', { name: 'Editar Registro - BIBLIOGRAFÍA' }).getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByDisplayValue('Autor'));
  });

  it('Escape sin cambios cierra y el foco vuelve a «Editar»', async () => {
    const { origen, onClose } = await abrirEdicion();
    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(origen);
  });

  it('Escape con cambios pide confirmar y no cierra', async () => {
    const { onClose } = await abrirEdicion();
    fireEvent.change(screen.getByDisplayValue('Autor'), { target: { value: 'Otro' } });
    escape();
    expect(screen.getByRole('alertdialog', { name: 'Descartar cambios' })).toBeTruthy();
    expect(screen.getByText('Hay cambios sin guardar. ¿Desea cerrar el formulario y descartarlos?')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('«Seguir editando» devuelve el foco al campo desde el que se pulsó Escape', async () => {
    const { onClose } = await abrirEdicion();
    const campo = screen.getByDisplayValue('Ref');
    campo.focus();
    fireEvent.change(campo, { target: { value: 'Ref 2' } });
    escape();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(campo);
    expect(screen.getByDisplayValue('Ref 2')).toBe(campo);
  });

  it('«Descartar» cierra el formulario y el foco vuelve a «Editar»', async () => {
    const { origen, onClose } = await abrirEdicion();
    fireEvent.change(screen.getByDisplayValue('Autor'), { target: { value: 'Otro' } });
    escape();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(origen);
  });

  it('Escape dentro de la confirmación solo cierra la confirmación', async () => {
    const { onClose } = await abrirEdicion();
    fireEvent.change(screen.getByDisplayValue('Autor'), { target: { value: 'Otro' } });
    escape();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Seguir editando' }));
    escape();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('dialog', { name: /Editar Registro/ })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('«Cancelar» cierra sin preguntar aunque haya cambios', async () => {
    const { origen, onClose } = await abrirEdicion();
    fireEvent.change(screen.getByDisplayValue('Autor'), { target: { value: 'Otro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(origen);
  });

  it('Escape mientras guarda no hace nada', async () => {
    let terminar: () => void = () => {};
    const onSave = vi.fn(() => new Promise<void>(res => { terminar = res; }));
    const { onClose } = await abrirEdicion({ onSave });
    fireEvent.change(screen.getByDisplayValue('Autor'), { target: { value: 'Otro' } });
    fireEvent.click(screen.getByRole('button', { name: 'Guardar Cambios' }));
    await screen.findByRole('button', { name: 'Guardando...' });
    escape();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('dialog', { name: /Editar Registro/ })).toBeTruthy();
    terminar();
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Guardando...' })).toBeNull());
  });

  it('cambiar el selector de compañía cuenta como cambio', async () => {
    const { onClose } = await abrirEdicion({
      coleccion: 'manejo_de_caja',
      record: { id: 'r1', 'Indicador de registro': 1, 'Sigla Compañía': 7 },
    });
    const selector = (await screen.findByLabelText('Compañía')) as HTMLSelectElement;
    await waitFor(() => expect(selector.options.length).toBeGreaterThan(2));
    fireEvent.change(selector, { target: { value: '' } });
    escape();
    expect(screen.getByRole('alertdialog', { name: 'Descartar cambios' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('GenericCreateModal: accesibilidad', () => {
  it('es un diálogo con nombre accesible y el foco inicial va a «Cerrar»', async () => {
    await abrirAlta();
    expect(screen.getByRole('dialog', { name: 'Nuevo Registro - BIBLIOGRAFÍA' }).getAttribute('aria-modal')).toBe('true');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cerrar' }));
  });

  it('Escape sin cambios cierra y el foco vuelve a «Nuevo Registro»', async () => {
    const { origen, onClose } = await abrirAlta();
    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(origen);
  });

  it('los valores por defecto precargados y los radios de tipo no cuentan como cambios', async () => {
    const { onClose } = await abrirAlta({ coleccion: 'corpus_christi' });
    expect((screen.getAllByRole('combobox')[0] as HTMLSelectElement).value).toBe('Potosí');
    fireEvent.click(screen.getByLabelText('Nueva ciudad'));
    escape();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape con cambios pide confirmar; «Seguir editando» devuelve el foco al campo', async () => {
    const { onClose } = await abrirAlta();
    const autores = screen.getByPlaceholderText('Autores del documento...');
    autores.focus();
    fireEvent.change(autores, { target: { value: 'Alguien' } });
    escape();
    expect(screen.getByRole('alertdialog', { name: 'Descartar cambios' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Seguir editando' }));
    expect(document.activeElement).toBe(autores);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('«Descartar» cierra formulario y confirmación en el mismo commit y el foco vuelve a «Nuevo Registro»', async () => {
    const { origen, onClose } = await abrirAlta();
    fireEvent.change(screen.getByPlaceholderText('Autores del documento...'), { target: { value: 'Alguien' } });
    escape();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(origen);
  });

  it('elegir un documento asociado (transacciones) cuenta como cambio', async () => {
    const { onClose } = await abrirAlta({ coleccion: 'transacciones' });
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: '1' } });
    escape();
    expect(screen.getByRole('alertdialog', { name: 'Descartar cambios' })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Escape dentro de la confirmación solo cierra la confirmación', async () => {
    const { onClose } = await abrirAlta();
    fireEvent.change(screen.getByPlaceholderText('Autores del documento...'), { target: { value: 'Alguien' } });
    escape();
    escape();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('dialog', { name: /Nuevo Registro/ })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('«Cancelar» y «Cerrar» cierran sin preguntar aunque haya cambios', async () => {
    const { onClose } = await abrirAlta();
    fireEvent.change(screen.getByPlaceholderText('Autores del documento...'), { target: { value: 'Alguien' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('mientras guarda, «Cerrar» está deshabilitado y Escape no hace nada', async () => {
    let terminar: (v: { id: string }) => void = () => {};
    addDoc.mockReturnValue(new Promise(res => { terminar = res; }));
    const { onClose } = await abrirAlta();
    fireEvent.change(screen.getByPlaceholderText('Autores del documento...'), { target: { value: 'Alguien' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles bibliográficos...'), { target: { value: 'Ref' } });
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    await screen.findByRole('button', { name: 'Guardando...' });
    expect((screen.getByRole('button', { name: 'Cerrar' }) as HTMLButtonElement).disabled).toBe(true);
    escape();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).toBeNull();
    terminar({ id: 'nuevo' });
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });
});
