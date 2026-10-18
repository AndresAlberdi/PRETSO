import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { contar } from '../utils/anuncios';

describe('contar', () => {
  it('usa plural con 0', () => {
    expect(contar(0, 'registro', 'registros')).toBe('0 registros');
  });
  it('usa singular con 1', () => {
    expect(contar(1, 'registro', 'registros')).toBe('1 registro');
  });
  it('usa plural con 2', () => {
    expect(contar(2, 'registro', 'registros')).toBe('2 registros');
  });
});

describe('clase visually-hidden', () => {
  it('existe en index.css con clip-path', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
    expect(css).toContain('.visually-hidden');
    expect(css).toContain('clip-path: inset(50%)');
  });
});
