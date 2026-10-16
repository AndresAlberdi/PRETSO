import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve(__dirname, '..');

// Texto blanco en línea: solo permitido sobre fondos oscuros verdaderos (contraste >= 4,5).
// Sobre colores de relleno (primario, acento, peligro, éxito) se usan los tokens --on-*.
// Lista blanca por fragmento de línea: archivo + trozo de texto de la línea + cantidad exacta de
// líneas que lo contienen. Una línea nueva con blanco en línea, aunque esté en un archivo ya
// listado, falla salvo que coincida con un fragmento justificado.
interface Permitido {
  archivo: string;
  fragmento: string;
  veces: number;
  motivo: string;
}

const LISTA_BLANCA: Permitido[] = [
  {
    archivo: 'components/SearchBar.tsx',
    fragmento: "background: 'rgba(255,255,255,0.05)', color: 'white' }}",
    veces: 2,
    motivo: 'campo y selector transparentes (rgba blanco 5 %) sobre el fondo oscuro de la página',
  },
  {
    archivo: 'components/SearchBar.tsx',
    fragmento: "background: 'transparent', color: 'white'",
    veces: 1,
    motivo: 'botón transparente sobre el fondo oscuro de la página',
  },
  {
    archivo: 'pages/UserManagement.tsx',
    fragmento: "background: 'var(--bg-body)', color: 'white' }}",
    veces: 2,
    motivo: 'campos con fondo var(--bg-body) oscuro',
  },
  {
    archivo: 'components/ProtectedRoute.tsx',
    fragmento: "textAlign: 'center', color: '#fff' }}>Cargando...",
    veces: 1,
    motivo: 'mensaje «Cargando...» directamente sobre el fondo oscuro de la página',
  },
  {
    archivo: 'components/AdminRoute.tsx',
    fragmento: "textAlign: 'center', color: '#fff' }}>Cargando...",
    veces: 1,
    motivo: 'mensaje «Cargando...» directamente sobre el fondo oscuro de la página',
  },
  {
    archivo: 'pages/IndiceCompanias.tsx',
    fragmento: "background: 'rgba(255,255,255,0.05)', color: 'white', minWidth",
    veces: 1,
    motivo: 'campo con fondo rgba blanco 5 % sobre el fondo oscuro de la página',
  },
];

function tsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.name === '__tests__'
      ? []
      : e.isDirectory()
        ? tsx(join(dir, e.name))
        : e.name.endsWith('.tsx')
          ? [join(dir, e.name)]
          : [],
  );
}

// `color:` seguido de un blanco literal en cualquier rama, incluidos ternarios
// (`color: cond ? 'white' : 'x'` o `color: cond ? 'x' : '#fff'`).
const PATRON = /\bcolor:\s*[^,}]*?(['"])(white|#fff|#ffffff)\1/i;

describe('texto blanco en línea', () => {
  const lineas: { rel: string; n: number; texto: string }[] = [];
  for (const f of tsx(SRC)) {
    const rel = f.slice(SRC.length + 1).replaceAll('\\', '/');
    readFileSync(f, 'utf8')
      .split('\n')
      .forEach((texto, i) => {
        if (PATRON.test(texto)) lineas.push({ rel, n: i + 1, texto });
      });
  }

  it('el detector reconoce ternarios con blanco en cualquier rama', () => {
    expect(PATRON.test("style={{ color: ok ? 'white' : 'red' }}")).toBe(true);
    expect(PATRON.test("style={{ color: ok ? 'red' : '#FFF' }}")).toBe(true);
    expect(PATRON.test("style={{ color: 'var(--on-primary)' }}")).toBe(false);
  });

  it('no queda color blanco en línea fuera de la lista blanca', () => {
    const sinPermiso = lineas
      .filter((l) => !LISTA_BLANCA.some((p) => p.archivo === l.rel && l.texto.includes(p.fragmento)))
      .map((l) => `${l.rel}:${l.n}`);
    expect(sinPermiso).toEqual([]);
  });

  it('cada entrada de la lista blanca sigue vigente con su cantidad exacta', () => {
    const desfasadas = LISTA_BLANCA.filter(
      (p) => lineas.filter((l) => l.rel === p.archivo && l.texto.includes(p.fragmento)).length !== p.veces,
    ).map((p) => `${p.archivo}: «${p.fragmento}»`);
    expect(desfasadas).toEqual([]);
  });
});
