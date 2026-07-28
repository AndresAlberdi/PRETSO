import { useState, useMemo } from 'react';

export function useSortableTable<T>(data: T[], initialKey: keyof T | null = null) {
  const [sortConfig, setSortConfig] = useState<{ key: keyof T, direction: 'asc' | 'desc' } | null>(
    initialKey ? { key: initialKey, direction: 'asc' } : null
  );

  const sortedData = useMemo(() => {
    let sortableItems = [...data];
    if (sortConfig !== null) {
      sortableItems.sort((a, b) => {
        let aValue = a[sortConfig.key];
        let bValue = b[sortConfig.key];
        
        // Handle numbers and numeric strings natively
        if (!isNaN(Number(aValue)) && !isNaN(Number(bValue)) && aValue !== '' && bValue !== '') {
          aValue = Number(aValue) as any;
          bValue = Number(bValue) as any;
        } else if (typeof aValue === 'string' && typeof bValue === 'string') {
          aValue = aValue.toLowerCase() as any;
          bValue = bValue.toLowerCase() as any;
        }

        if (aValue === null || aValue === undefined || aValue === '') return 1;
        if (bValue === null || bValue === undefined || bValue === '') return -1;
        
        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableItems;
  }, [data, sortConfig]);

  const requestSort = (key: keyof T) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  return { items: sortedData, requestSort, sortConfig };
}
