import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, within, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { MemoryRouter, Routes, Route } from 'react-router';
import AgregarTransaccion from '../pages/AgregarTransaccion';
import AdminRoute from '../components/AdminRoute';

const estado = vi.hoisted(() => ({ isAdmin: false, adminLoading: false }));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isAdmin: estado.isAdmin, adminLoading: estado.adminLoading }) }));

afterEach(() => { cleanup(); estado.isAdmin = false; estado.adminLoading = false; });

function montar() {
  return render(<MemoryRouter><AgregarTransaccion /></MemoryRouter>);
}

describe('AgregarTransaccion', () => {
  it('tiene un solo h1 «Agregar transacción»', () => {
    montar();
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1.length).toBe(1);
    expect(h1[0].textContent).toBe('Agregar transacción');
  });

  it('«Solo editores» usa la clase etiqueta-editor', () => {
    montar();
    expect(screen.getByText('Solo editores').classList.contains('etiqueta-editor')).toBe(true);
  });

  it('muestra el texto explicativo', () => {
    montar();
    expect(screen.getByText('Todo registro nuevo parte de una transacción. Después se añade en la sección correspondiente con Editar.')).toBeTruthy();
  });

  it('la navegación «Herramientas de carga» tiene dos enlaces con clase tarjeta-carga', () => {
    montar();
    const nav = screen.getByRole('navigation', { name: 'Herramientas de carga' });
    expect(within(nav).getAllByRole('link').length).toBe(2);
    const docs = within(nav).getByRole('link', { name: 'Documentos' });
    const trans = within(nav).getByRole('link', { name: 'Transacciones' });
    expect(docs.getAttribute('href')).toBe('/documentos');
    expect(trans.getAttribute('href')).toBe('/transacciones');
    expect(docs.classList.contains('tarjeta-carga')).toBe(true);
    expect(trans.classList.contains('tarjeta-carga')).toBe(true);
  });

  it('la fuente no usa estilos en línea', () => {
    const fuente = readFileSync(resolve(__dirname, '..', 'pages', 'AgregarTransaccion.tsx'), 'utf8');
    expect(fuente).not.toContain('style={{');
  });

  function ruta() {
    return render(
      <MemoryRouter initialEntries={['/agregar']}>
        <Routes>
          <Route path="/" element={<p>inicio</p>} />
          <Route path="/agregar" element={<AdminRoute><AgregarTransaccion /></AdminRoute>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('AdminRoute redirige a «/» a quien no es administrador', () => {
    estado.isAdmin = false;
    ruta();
    expect(screen.getByText('inicio')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Agregar transacción' })).toBeNull();
  });

  it('un administrador ve la pantalla', () => {
    estado.isAdmin = true;
    ruta();
    expect(screen.getByRole('heading', { level: 1, name: 'Agregar transacción' })).toBeTruthy();
  });
});
