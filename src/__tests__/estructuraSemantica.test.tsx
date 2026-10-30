import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import Login from '../pages/Login';
import ManejoCaja from '../pages/ManejoCaja';

const SRC = resolve(__dirname, '..');

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
  getAuth: vi.fn(() => ({})),
  signInWithEmailAndPassword: vi.fn(),
}));
vi.mock('../firebase', () => ({ auth: {}, db: {}, firebaseConfig: {} }));
vi.mock('../utils/audit', () => ({ logAction: vi.fn() }));
vi.mock('react-router', () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: '/x', search: '', state: null }),
}));
vi.mock('../context/AdminContext', () => ({ useAdmin: () => ({ isAdmin: true, isEditMode: true }) }));

const companias = [
  { id: 'c7', 'Indicador de registro': 7, 'Sigla Compañía': 'GA-JR', 'Nombre Compañía': 'Compañía de Alarcón', Autores: 'Alarcón y Ramírez' },
];
let colecciones: Record<string, Array<{ id: string } & Record<string, unknown>>> = {};
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, nombre: string) => nombre,
  query: (nombre: string) => nombre,
  where: vi.fn(), doc: vi.fn(), deleteDoc: vi.fn(), updateDoc: vi.fn(), addDoc: vi.fn(),
  getDocs: async (nombre: string) => ({
    docs: (colecciones[nombre] ?? []).map(d => ({ id: d.id, data: () => d })),
  }),
}));

beforeEach(() => {
  colecciones = {
    companias,
    transacciones: [],
    manejo_de_caja: [{ id: 'm1', 'Sigla Compañía': 7, Ciudad: 'Potosí', 'Año': 1600, Ingresos: 100 }],
  };
});
afterEach(cleanup);

function archivos(subcarpeta: string): [string, string][] {
  const dir = join(SRC, subcarpeta);
  return readdirSync(dir)
    .filter(f => f.endsWith('.tsx'))
    .map(f => [f, readFileSync(join(dir, f), 'utf8')]);
}
const PAGINAS = archivos('pages');
const TODOS = [...PAGINAS, ...archivos('components')];

describe('estructura semántica: análisis estático', () => {
  it('a) ningún <th> está vacío', () => {
    for (const [nombre, src] of TODOS) {
      expect(src.match(/<th\b[^>]*>\s*<\/th>/g), nombre).toBeNull();
      expect(src.match(/<th\b[^>]*\/>/g), nombre).toBeNull();
    }
  });

  it('b) cada <table> lleva un caption oculto como primer hijo', () => {
    for (const [nombre, src] of TODOS) {
      const tablas = (src.match(/<table\b/g) ?? []).length;
      const conCaption = (src.match(/<table\b[^>]*>\s*<caption className="visually-hidden">[^<]*\S[^<]*<\/caption>/g) ?? []).length;
      expect(conCaption, nombre).toBe(tablas);
    }
  });

  it('c) las celdas de acciones usan un div y no display:flex en el td', () => {
    for (const [nombre, src] of TODOS) {
      expect(src.match(/<td\b[^>]*display:\s*'flex'/), nombre).toBeNull();
    }
    // El conteo es exacto a propósito: fija en qué páginas hay celdas de acciones. Si se añade una
    // columna de acciones legítima (o se quita una), actualice el valor esperado de la página.
    const esperado: Record<string, number> = {
      'ManejoCaja.tsx': 2, 'Salarios.tsx': 2, 'CorpusChristi.tsx': 2, 'Indicadores.tsx': 2,
      'IndiceCompanias.tsx': 1, 'Documentos.tsx': 1, 'Transacciones.tsx': 1,
    };
    for (const [nombre, src] of PAGINAS) {
      const cuenta = (src.match(/className="acciones-celda"/g) ?? []).length;
      expect(cuenta, nombre).toBe(esperado[nombre] ?? 0);
    }
    const css = readFileSync(join(SRC, 'index.css'), 'utf8');
    const regla = css.match(/\.acciones-celda\s*\{([^}]*)\}/);
    expect(regla).not.toBeNull();
    expect(regla![1]).toMatch(/display:\s*flex/);
    expect(regla![1]).not.toMatch(/flex-wrap/);
  });

  it('d) cada página tiene exactamente un h1', () => {
    for (const [nombre, src] of PAGINAS) {
      expect((src.match(/<h1\b/g) ?? []).length, nombre).toBe(1);
    }
  });

  it('e) los encabezados empiezan en h1 y no saltan niveles', () => {
    for (const [nombre, src] of PAGINAS) {
      const niveles = [...src.matchAll(/<h([1-6])\b/g)].map(m => Number(m[1]));
      expect(niveles[0], nombre).toBe(1);
      niveles.forEach((n, i) => {
        if (i > 0) expect(n - niveles[i - 1], `${nombre}: ${niveles.join(',')}`).toBeLessThanOrEqual(1);
      });
    }
  });

  it('f) Auditoría y la ventana de compañía declaran scope', () => {
    const auditoria = readFileSync(join(SRC, 'pages/Auditoria.tsx'), 'utf8');
    expect((auditoria.match(/<th scope="col">/g) ?? []).length).toBe(5);
    expect(readFileSync(join(SRC, 'components/CompaniaModal.tsx'), 'utf8')).toContain('<th scope="row"');
  });
});

describe('estructura semántica: render', () => {
  it('g) el login tiene main, un solo h1 y «Iniciar Sesión» como h2', () => {
    render(<Login />);
    const main = screen.getByRole('main');
    expect(main.id).toBe('contenido');
    expect(main.getAttribute('tabindex')).toBe('-1');
    const h1 = screen.getAllByRole('heading', { level: 1 });
    expect(h1).toHaveLength(1);
    expect(h1[0].textContent).toMatch(/PRETSO/);
    expect(screen.getByRole('heading', { level: 2, name: 'Iniciar Sesión' })).toBeTruthy();
  });

  it('h) Manejo de Caja: tablas con título, columnas con nombre y acciones sin flex en el td', async () => {
    render(<ManejoCaja />);
    const lista = await screen.findByRole('table', { name: 'Compañías de Manejo de Caja' });
    expect(screen.getByRole('columnheader', { name: 'Detalle' })).toBeTruthy();
    const fila = within(lista).getByText(/Compañía de Alarcón/).closest('tr') as HTMLElement;
    fireEvent.click(within(fila).getByRole('button', { name: 'CAJA' }));
    const detalle = await screen.findByRole('table', { name: /^Registros de caja de / });
    expect(within(detalle).getByRole('columnheader', { name: 'Transacción' })).toBeTruthy();
    expect(within(detalle).getByRole('columnheader', { name: 'Admin' })).toBeTruthy();
    const celda = screen.getAllByRole('button', { name: 'Editar' })[0].closest('td') as HTMLElement;
    expect(celda.style.display).toBe('');
    expect(celda.querySelector('.acciones-celda')).not.toBeNull();
  });
});
