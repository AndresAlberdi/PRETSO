import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const setIsEditMode = vi.fn();
let estado: { isAdmin: boolean; isEditMode: boolean; setIsEditMode: typeof setIsEditMode };
vi.mock('../context/AdminContext', () => ({ useAdmin: () => estado }));

import EditToggle from '../components/EditToggle';
import EditModeRouteReset from '../components/EditModeRouteReset';

beforeEach(() => {
  setIsEditMode.mockReset();
  estado = { isAdmin: true, isEditMode: false, setIsEditMode };
});
afterEach(cleanup);

describe('EditToggle', () => {
  it('no se muestra sin privilegio de administrador', () => {
    estado = { isAdmin: false, isEditMode: false, setIsEditMode };
    const { container } = render(<EditToggle />);
    expect(container.firstChild).toBeNull();
  });

  it('el administrador ve «Editar» y activa el modo edición', () => {
    render(<EditToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(setIsEditMode).toHaveBeenCalledWith(true);
  });

  it('en modo edición muestra «Salir de edición» y lo desactiva', () => {
    estado = { isAdmin: true, isEditMode: true, setIsEditMode };
    render(<EditToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'Salir de edición' }));
    expect(setIsEditMode).toHaveBeenCalledWith(false);
  });
});

let navegar: ReturnType<typeof useNavigate>;
function Capturador() {
  navegar = useNavigate();
  return null;
}

function montar() {
  render(
    <MemoryRouter initialEntries={['/caja']}>
      <EditModeRouteReset />
      <Capturador />
      <Routes>
        <Route path="*" element={null} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('EditModeRouteReset', () => {
  it('no apaga el modo edición en la carga inicial', () => {
    montar();
    expect(setIsEditMode).not.toHaveBeenCalled();
  });

  it('lo apaga al cambiar de ruta', () => {
    montar();
    act(() => { navegar('/corpus'); });
    expect(setIsEditMode).toHaveBeenCalledWith(false);
  });

  it('no lo apaga al navegar a la misma ruta', () => {
    montar();
    act(() => { navegar('/caja', { replace: true }); });
    expect(setIsEditMode).not.toHaveBeenCalled();
  });
});

describe('páginas con modo edición', () => {
  const paginas = ['ManejoCaja', 'Salarios', 'CorpusChristi', 'Indicadores', 'IndiceCompanias', 'Bibliografia', 'Documentos', 'Transacciones'];
  it.each(paginas)('%s contiene <EditToggle />', (nombre) => {
    const fuente = readFileSync(resolve(__dirname, '..', 'pages', `${nombre}.tsx`), 'utf8');
    expect(fuente).toContain('<EditToggle />');
  });
});
