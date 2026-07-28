import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useSortableTable } from '../hooks/useSortableTable';

describe('useSortableTable', () => {
  const mockData = [
    { id: 1, name: 'Zebra', value: 100 },
    { id: 2, name: 'Apple', value: 50 },
    { id: 3, name: 'Mango', value: 75 },
    { id: 4, name: 'Apple', value: 25 },
  ];

  it('should initialize with original data and no sort configuration', () => {
    const { result } = renderHook(() => useSortableTable(mockData));

    expect(result.current.items).toEqual(mockData);
    expect(result.current.sortConfig).toBeNull();
  });

  it('should sort data in ascending order when a column is clicked once', () => {
    const { result } = renderHook(() => useSortableTable(mockData));

    act(() => {
      result.current.requestSort('name');
    });

    expect(result.current.sortConfig).toEqual({ key: 'name', direction: 'asc' });
    expect(result.current.items[0].name).toBe('Apple');
    expect(result.current.items[1].name).toBe('Apple');
    expect(result.current.items[2].name).toBe('Mango');
    expect(result.current.items[3].name).toBe('Zebra');
  });

  it('should sort data in descending order when the same column is clicked twice', () => {
    const { result } = renderHook(() => useSortableTable(mockData));

    act(() => {
      result.current.requestSort('name');
    });

    act(() => {
      result.current.requestSort('name');
    });

    expect(result.current.sortConfig).toEqual({ key: 'name', direction: 'desc' });
    expect(result.current.items[0].name).toBe('Zebra');
    expect(result.current.items[1].name).toBe('Mango');
    expect(result.current.items[2].name).toBe('Apple');
  });

  it('should handle numeric sorting correctly', () => {
    const { result } = renderHook(() => useSortableTable(mockData));

    act(() => {
      result.current.requestSort('value');
    });

    expect(result.current.items[0].value).toBe(25);
    expect(result.current.items[3].value).toBe(100);
  });
});
