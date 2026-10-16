import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SRC = resolve(__dirname, '..');

// Texto blanco en línea: solo permitido sobre fondos oscuros verdaderos (contraste >= 4,5).
// Sobre colores de relleno (primario, acento, peligro, éxito) se usan los tokens --on-*.
// Lista blanca: archivo -> cantidad máxima de apariciones y motivo.
const LISTA_BLANCA: Record<string, { max: number; motivo: string }> = {
  'components/SearchBar.tsx': {
    max: 3,
    motivo: 'campos y botón transparente (rgba blanco 5 %) sobre el fondo oscuro de la página',
  },
  'pages/UserManagement.tsx': {
    max: 2,
    motivo: 'campos con fondo var(--bg-body) oscuro',
  },
  'components/ProtectedRoute.tsx': {
    max: 1,
    motivo: 'mensaje «Cargando...» directamente sobre el fondo oscuro de la página',
  },
  'components/AdminRoute.tsx': {
    max: 1,
    motivo: 'mensaje «Cargando...» directamente sobre el fondo oscuro de la página',
  },
  'pages/IndiceCompanias.tsx': {
    max: 1,
    motivo: 'campo con fondo rgba blanco 5 % sobre el fondo oscuro de la página',
  },
};

function tsx(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? tsx(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : [],
  );
}

const PATRON = /\bcolor:\s*(['"])(white|#fff|#ffffff)\1/gi;

describe('texto blanco en línea', () => {
  const archivos = [...tsx(join(SRC, 'pages')), ...tsx(join(SRC, 'components'))];

  it('no queda color blanco en línea fuera de la lista blanca', () => {
    const excesos: string[] = [];
    for (const f of archivos) {
      const rel = f.slice(SRC.length + 1).replaceAll('\\', '/');
      const n = [...readFileSync(f, 'utf8').matchAll(PATRON)].length;
      const permitido = LISTA_BLANCA[rel]?.max ?? 0;
      if (n > permitido) excesos.push(`${rel}: ${n} (permitido ${permitido})`);
    }
    expect(excesos).toEqual([]);
  });
});
