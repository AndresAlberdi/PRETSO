import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';

let estado: Record<string, unknown> = {};
vi.mock('../context/AdminContext', () => ({ useAdmin: () => estado }));

import { useCanEdit } from '../hooks/useCanEdit';

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
