import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import Salarios from '../pages/Salarios';

const colecciones: Record<string, any[]> = {
  companias: [{ id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', Autores: 'Alarcón' }],
  transacciones: [],
  salarios: [{ id: 's1', 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600, 'Transacción': 999 }],
};

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
  where: vi.fn(), doc: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), addDoc: vi.fn(),
  getDocs: async (nombre: string) => ({
    docs: (colecciones[nombre] ?? []).map(d => ({ id: d.id, data: () => d })),
  }),
}));

afterEach(cleanup);

const leer = (ruta: string) => readFileSync(resolve(__dirname, ruta), 'utf8');

describe('aviso de enlace roto en Remuneraciones', () => {
  it('se anuncia como alerta y su botón «Cerrar» usa los tokens de contraste', async () => {
    render(<Salarios />);
    await screen.findByText(/Mostrando \d+ registros/);
    fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Autores' } });
    fireEvent.change(screen.getByPlaceholderText('Añadir filtro...'), { target: { value: 'Alarcón' } });
    fireEvent.click(screen.getAllByRole('button', { name: 'Buscar' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: 'Enlace Roto' }));
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toBe('El enlace a la transacción 999 está roto.');
    const cerrar = screen.getByRole('button', { name: 'Cerrar' });
    expect(cerrar.style.cssText).toContain('background: var(--on-danger)');
    expect(cerrar.style.cssText).toContain('color: var(--danger-color)');
    expect(cerrar.style.cssText).not.toContain('white');
    expect((alerta.parentElement as HTMLElement).style.cssText).toContain('background: var(--danger-color)');
  });
});

describe.each(['Salarios', 'ManejoCaja', 'CorpusChristi', 'Indicadores'])('%s: fuente del aviso', nombre => {
  const fuente = leer(`../pages/${nombre}.tsx`);
  const cuenta = (texto: string) => fuente.split(texto).length - 1;
  it('el botón «Cerrar» usa tokens', () => {
    expect(cuenta("background: 'var(--on-danger)', color: 'var(--danger-color)'")).toBe(1);
    expect(cuenta("background: 'white', color: '#ff4d4f'")).toBe(0);
  });
  it('el texto del aviso es una alerta', () => {
    expect(cuenta('<p role="alert" style={{ margin: 0 }}>{brokenLinkAlert}</p>')).toBe(1);
  });
});

function luminancia(hex: string): number {
  const canales = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * canales[0] + 0.7152 * canales[1] + 0.0722 * canales[2];
}

describe('contraste del botón «Cerrar»', () => {
  it('--on-danger sobre --danger-color alcanza 4,5:1', () => {
    const css = leer('../index.css');
    const valor = (token: string) => {
      const m = css.match(new RegExp(`${token}:\\s*(#[0-9a-fA-F]{6})`));
      expect(m, token).not.toBeNull();
      return m![1];
    };
    const a = luminancia(valor('--danger-color'));
    const b = luminancia(valor('--on-danger'));
    const contraste = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    expect(contraste).toBeGreaterThanOrEqual(4.5);
  });
});
