import { describe, it, expect } from 'vitest';
import { asignarNombresUnicos, sanearNombreArchivo } from '../../utils/dataset/nombres';

describe('sanearNombreArchivo', () => {
  it('sustituye separadores y recorta', () => {
    expect(sanearNombreArchivo('GA/AR')).toBe('GA-AR');
    expect(sanearNombreArchivo('  Madrid. ')).toBe('Madrid');
  });
  it('evita nombres reservados y vacíos', () => {
    expect(sanearNombreArchivo('CON')).toBe('CON_');
    expect(sanearNombreArchivo('CON.txt')).toBe('CON_.txt');
    expect(sanearNombreArchivo('')).toBe('sin-nombre');
  });
  it('corta a 80 caracteres y conserva tildes', () => {
    expect(Array.from(sanearNombreArchivo('a'.repeat(200)))).toHaveLength(80);
    expect(sanearNombreArchivo('Compañía Ñandú')).toBe('Compañía Ñandú');
  });
});

describe('asignarNombresUnicos', () => {
  it('distingue sin mayúsculas ni tildes', () => {
    expect(asignarNombresUnicos(['ABC', 'abc', 'Ábc'])).toEqual(['ABC', 'abc-2', 'Ábc-3']);
  });
  it('evita choques con sufijos existentes', () => {
    expect(asignarNombresUnicos(['A', 'A', 'A-2'])).toEqual(['A', 'A-2', 'A-2-2']);
  });
});

describe('sanearNombreArchivo: caracteres de control y de formato', () => {
  it('sustituye los bidireccionales, de ancho cero y C1 por guion', () => {
    const r = sanearNombreArchivo('abc‮lmx.exe');
    expect(r).not.toContain('‮');
    expect(r).toBe('abc-lmx.exe');
    expect(sanearNombreArchivo('a​b\u0085c﻿d⁦e')).toBe('a-b-c-d-e');
  });
});
