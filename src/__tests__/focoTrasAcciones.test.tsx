import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { useEffect, useState } from 'react';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import SearchBar from '../components/SearchBar';
import GenericCreateModal from '../components/GenericCreateModal';
import GenericEditModal from '../components/GenericEditModal';
import ManejoCaja from '../pages/ManejoCaja';
import { useRestoreFocusOnViewChange } from '../hooks/useRestoreFocusOnViewChange';

const colecciones: Record<string, any[]> = {
  companias: [{ id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', Autores: 'Alarcón' }],
  transacciones: [],
  manejo_de_caja: [{ id: 'm1', 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600, Ingresos: 100 }],
  bibliografia: [],
};

const setDoc = vi.hoisted(() => vi.fn());
vi.mock('../firebase', () => ({ db: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/x', search: '', state: null }),
}));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isEditMode: false }) }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  where: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), addDoc: vi.fn(),
  doc: (coleccion: string) => ({ id: 'nuevo', coleccion }),
  setDoc: (...a: unknown[]) => setDoc(...a),
  getDocs: async (nombre: string) => ({
    docs: (colecciones[nombre] ?? []).map(d => ({ id: d.id, data: () => d })),
  }),
}));

beforeEach(() => { setDoc.mockReset().mockResolvedValue(undefined); });
afterEach(cleanup);

function agregar(texto: string) {
  fireEvent.change(screen.getByPlaceholderText('Añadir filtro...'), { target: { value: texto } });
  fireEvent.click(screen.getAllByRole('button', { name: 'Agregar' })[0]);
}

function quitar(texto: string) {
  const boton = screen.getByRole('button', { name: `Quitar filtro Texto libre: ${texto}` });
  boton.focus();
  fireEvent.click(boton);
}

function montarBuscador() {
  render(<SearchBar onSearch={vi.fn()} categories={[{ id: 'x', label: 'Texto libre' }]} />);
  agregar('a');
  agregar('b');
  agregar('c');
}

describe('SearchBar: foco al quitar fichas', () => {
  it('quitar una ficha intermedia lleva el foco a la ficha vecina', () => {
    montarBuscador();
    const antes = screen.getByRole('button', { name: 'Quitar filtro Texto libre: b' });
    quitar('b');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Quitar filtro Texto libre: c' }));
    expect(document.activeElement).not.toBe(antes);
  });

  it('quitar la última ficha lleva el foco a la anterior', () => {
    montarBuscador();
    quitar('c');
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Quitar filtro Texto libre: b' }));
  });

  it('quitar la única ficha lleva el foco al campo «Añadir filtro»', () => {
    render(<SearchBar onSearch={vi.fn()} categories={[{ id: 'x', label: 'Texto libre' }]} />);
    agregar('a');
    quitar('a');
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Añadir filtro' }));
  });

  it('«Limpiar» lleva el foco al campo', () => {
    montarBuscador();
    const limpiar = screen.getByRole('button', { name: 'Limpiar' });
    limpiar.focus();
    fireEvent.click(limpiar);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Añadir filtro' }));
  });
});

function ArnesHook({ conservar, inicial = 'a', cambiarEnEfecto = false }: { conservar: boolean; inicial?: string; cambiarEnEfecto?: boolean }) {
  const [vista, setVista] = useState(inicial);
  useRestoreFocusOnViewChange(vista);
  useEffect(() => {
    if (cambiarEnEfecto) setVista('b');
  }, [cambiarEnEfecto]);
  return (
    <main id="contenido" tabIndex={-1}>
      {vista === 'a' && !conservar && <button onClick={() => setVista('b')}>Origen</button>}
      {conservar && (
        <>
          <input aria-label="Campo" />
          <button onClick={() => setVista('b')}>Cambiar</button>
        </>
      )}
      <p>{vista}</p>
    </main>
  );
}

describe('useRestoreFocusOnViewChange', () => {
  it('si el botón desaparece al cambiar la vista, el foco va a main', () => {
    render(<ArnesHook conservar={false} />);
    const origen = screen.getByRole('button', { name: 'Origen' });
    origen.focus();
    fireEvent.click(origen);
    expect(screen.queryByRole('button', { name: 'Origen' })).toBeNull();
    expect(document.activeElement).toBe(document.getElementById('contenido'));
  });

  it('si el control enfocado persiste, el foco no se mueve', () => {
    render(<ArnesHook conservar />);
    const campo = screen.getByRole('textbox', { name: 'Campo' });
    campo.focus();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    expect(screen.getByText('b')).toBeTruthy();
    expect(document.activeElement).toBe(campo);
  });

  it('si el control enfocado sigue conectado aunque el foco esté en body, no se mueve a main', () => {
    render(<ArnesHook conservar />);
    const campo = screen.getByRole('textbox', { name: 'Campo' });
    campo.focus();
    campo.blur();
    fireEvent.click(screen.getByRole('button', { name: 'Cambiar' }));
    expect(screen.getByText('b')).toBeTruthy();
    expect(document.activeElement).toBe(document.body);
  });

  it('un cambio de vista tras el montaje sin foco previo no enfoca main', () => {
    render(<ArnesHook conservar inicial="a" cambiarEnEfecto />);
    expect(screen.getByText('b')).toBeTruthy();
    expect(document.activeElement).toBe(document.body);
    expect(document.activeElement).not.toBe(document.getElementById('contenido'));
  });
});

describe('Páginas de consulta', () => {
  it('ManejoCaja: CAJA y «Volver a listado inicial» llevan el foco a main', async () => {
    render(<main id="contenido" tabIndex={-1}><ManejoCaja /></main>);
    const caja = await screen.findByRole('button', { name: 'CAJA' });
    caja.focus();
    fireEvent.click(caja);
    const volver = await screen.findByRole('button', { name: 'Volver a listado inicial' });
    expect(document.activeElement).toBe(document.getElementById('contenido'));
    volver.focus();
    fireEvent.click(volver);
    await screen.findByRole('button', { name: 'CAJA' });
    expect(document.activeElement).toBe(document.getElementById('contenido'));
  });

  it.each(['ManejoCaja', 'Salarios', 'CorpusChristi', 'Indicadores'])('%s usa el hook de foco', nombre => {
    const fuente = readFileSync(`src/pages/${nombre}.tsx`, 'utf8');
    expect(fuente.includes('useRestoreFocusOnViewChange(')).toBe(true);
  });
});

describe('Botones de guardar', () => {
  it('alta: «Guardando...» sigue enfocado, con aria-disabled y sin disabled; si falla, el foco permanece', async () => {
    // Objeto «thenable»: permite rechazar la escritura a voluntad sin promesas rechazadas sueltas.
    let rechazar: (e: Error) => void = () => {};
    setDoc.mockImplementation(() => ({ then: (_ok: unknown, ko: (e: Error) => void) => { rechazar = ko; } }));
    render(<GenericCreateModal collectionName="bibliografia" onClose={vi.fn()} onCreated={vi.fn()} />);
    await screen.findByRole('dialog', { name: /Nuevo Registro - / });
    await waitFor(() => expect(screen.queryByText('Cargando opciones...')).toBeNull());
    fireEvent.change(screen.getByPlaceholderText('Autores del documento...'), { target: { value: 'Alguien' } });
    fireEvent.change(screen.getByPlaceholderText('Detalles bibliográficos...'), { target: { value: 'Ref' } });
    const enviar = screen.getByRole('button', { name: 'Crear Registro' });
    enviar.focus();
    fireEvent.submit(document.querySelector('form') as HTMLFormElement);
    const guardando = await screen.findByRole('button', { name: 'Guardando...' });
    expect(guardando.getAttribute('aria-disabled')).toBe('true');
    expect((guardando as HTMLButtonElement).disabled).toBe(false);
    expect(document.activeElement).toBe(guardando);
    rechazar(new Error('fallo'));
    const tras = await screen.findByRole('button', { name: 'Crear Registro' });
    expect(tras.getAttribute('aria-disabled')).toBeNull();
    expect(document.activeElement).toBe(tras);
  });

  it('edición: el envío lleva el foco al botón y un segundo envío no repite onSave', async () => {
    let terminar: () => void = () => {};
    const onSave = vi.fn().mockReturnValue(new Promise<void>(res => { terminar = res; }));
    render(
      <GenericEditModal
        collectionName="bibliografia"
        record={{ id: 'b1', Autores: 'Autor', 'Referencias bibliográficas': 'Ref' }}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    await screen.findByRole('dialog', { name: /Editar Registro/ });
    const campo = screen.getAllByRole('textbox')[0];
    campo.focus();
    const form = document.querySelector('form') as HTMLFormElement;
    fireEvent.submit(form);
    const boton = await screen.findByRole('button', { name: 'Guardando...' });
    expect(document.activeElement).toBe(boton);
    expect(boton.getAttribute('aria-disabled')).toBe('true');
    fireEvent.submit(form);
    expect(onSave).toHaveBeenCalledTimes(1);
    terminar();
    await screen.findByRole('button', { name: 'Guardar Cambios' });
  });

  it('edición: si onSave rechaza, vuelve «Guardar Cambios» sin aria-disabled y se puede reenviar', async () => {
    const onSave = vi.fn().mockImplementation(() => ({ then: (_ok: unknown, ko: (e: Error) => void) => { ko(new Error('fallo')); } }));
    render(
      <GenericEditModal
        collectionName="bibliografia"
        record={{ id: 'b1', Autores: 'Autor', 'Referencias bibliográficas': 'Ref' }}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    await screen.findByRole('dialog', { name: /Editar Registro/ });
    const form = document.querySelector('form') as HTMLFormElement;
    // El rechazo se propaga desde el manejador; se captura aquí para no ensuciar la ejecución.
    const previos = process.listeners('unhandledRejection');
    process.removeAllListeners('unhandledRejection');
    const capturados: unknown[] = [];
    process.on('unhandledRejection', motivo => { capturados.push(motivo); });
    fireEvent.submit(form);
    const boton = await screen.findByRole('button', { name: 'Guardar Cambios' });
    expect(boton.getAttribute('aria-disabled')).toBeNull();
    fireEvent.submit(form);
    await screen.findByRole('button', { name: 'Guardar Cambios' });
    expect(onSave).toHaveBeenCalledTimes(2);
    await new Promise(r => setTimeout(r, 0));
    process.removeAllListeners('unhandledRejection');
    previos.forEach(f => process.on('unhandledRejection', f));
    expect(capturados.length).toBe(2);
  });
});
