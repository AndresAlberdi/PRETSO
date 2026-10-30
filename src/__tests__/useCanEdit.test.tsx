import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

let estado: Record<string, unknown> = {};
vi.mock('../context/AdminContext', () => ({ useAdmin: () => estado }));

import { useCanEdit, useCanLoad } from '../hooks/useCanEdit';

function evaluar(valor: Record<string, unknown>): boolean {
  estado = valor;
  return renderHook(() => useCanEdit()).result.current;
}

describe('useCanEdit', () => {
  it('es verdadero solo con administrador y modo edición', () => {
    expect(evaluar({ isAdmin: true, isEditMode: true })).toBe(true);
  });
  it('es falso si falta alguna de las dos condiciones', () => {
    expect(evaluar({ isAdmin: true, isEditMode: false })).toBe(false);
    expect(evaluar({ isAdmin: false, isEditMode: true })).toBe(false);
    expect(evaluar({ isAdmin: false, isEditMode: false })).toBe(false);
  });
  it('un lector con modo edición forzado no puede editar', () => {
    expect(evaluar({ isAdmin: false, isReader: true, isEditMode: true })).toBe(false);
  });
  it('sin isAdmin definido no puede editar', () => {
    expect(evaluar({ isEditMode: true })).toBe(false);
  });
});

describe('useCanLoad', () => {
  const cargar = (valor: Record<string, unknown>): boolean => {
    estado = valor;
    return renderHook(() => useCanLoad()).result.current;
  };
  it('un administrador puede cargar, con o sin modo edición', () => {
    expect(cargar({ isAdmin: true, isEditMode: false })).toBe(true);
    expect(cargar({ isAdmin: true, isEditMode: true })).toBe(true);
  });
  it('un lector con modo edición forzado no puede cargar', () => {
    expect(cargar({ isAdmin: false, isReader: true, isEditMode: true })).toBe(false);
  });
  it('sin isAdmin definido no puede cargar', () => {
    expect(cargar({ isEditMode: true })).toBe(false);
  });
  it('un isAdmin que no es booleano verdadero no puede cargar', () => {
    expect(cargar({ isAdmin: 'true' as unknown })).toBe(false);
  });
});
