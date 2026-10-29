import { useLayoutEffect, useRef, useState } from 'react';

interface SearchCategory {
  id: string;
  label: string;
}

export interface SearchFilter {
  category: string;
  query: string;
}

interface SearchBarProps {
  onSearch: (filters: SearchFilter[]) => void;
  categories: SearchCategory[];
}

export default function SearchBar({ onSearch, categories }: SearchBarProps) {
  const [category, setCategory] = useState(categories[0]?.id || '');
  const [query, setQuery] = useState('');
  // Cada ficha lleva un id estable (solo interno) para que React conserve su nodo al quitar otra.
  const [filters, setFilters] = useState<(SearchFilter & { id: number })[]>([]);
  const nextId = useRef(0);
  const toPublic = (list: (SearchFilter & { id: number })[]): SearchFilter[] =>
    list.map(({ category: c, query: q }) => ({ category: c, query: q }));
  const inputRef = useRef<HTMLInputElement>(null);
  const removeRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const pendingFocus = useRef<number | 'input' | null>(null);

  // Tras quitar fichas, el foco pasa al filtro vecino o al campo (WCAG 2.4.3).
  useLayoutEffect(() => {
    const p = pendingFocus.current;
    if (p === null) return;
    pendingFocus.current = null;
    if (p === 'input') inputRef.current?.focus();
    else removeRefs.current[p]?.focus();
  }, [filters]);

  const handleAddFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    const catToUse = category || categories[0]?.id || '';
    const newFilters = [...filters, { id: nextId.current++, category: catToUse, query: query.trim() }];
    setFilters(newFilters);
    setQuery('');
    onSearch(toPublic(newFilters));
  };

  const handleRemoveFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    pendingFocus.current = newFilters.length > 0 ? Math.min(index, newFilters.length - 1) : 'input';
    setFilters(newFilters);
    onSearch(toPublic(newFilters));
  };

  const handleClearAll = () => {
    pendingFocus.current = 'input';
    setFilters([]);
    setQuery('');
    onSearch([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
      <form onSubmit={handleAddFilter} className="barra-busqueda">
        <select 
          value={category} 
          onChange={e => setCategory(e.target.value)}
          aria-label="Buscar en"
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--input-border)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
        >
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <input 
          ref={inputRef}
          type="text" 
          value={query} 
          onChange={e => setQuery(e.target.value)} 
          placeholder="Añadir filtro..."
          aria-label="Añadir filtro"
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--input-border)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
        />
        <button type="submit" style={{ padding: '0.5rem 1rem', background: 'transparent', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', borderRadius: '4px', fontWeight: 'bold' }}>
          Agregar
        </button>
        <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'var(--on-primary)', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
          Buscar
        </button>
        {filters.length > 0 && (
          <button type="button" onClick={handleClearAll} style={{ padding: '0.5rem 1rem', background: 'transparent', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
            Limpiar
          </button>
        )}
      </form>
      
      {filters.length > 0 && (
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
          {filters.map((f, i) => {
            const catLabel = categories.find(c => c.id === f.category)?.label || f.category;
            return (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '16px', fontSize: '0.85rem', maxWidth: '100%' }}>
              <span style={{ color: 'var(--primary-color)', marginRight: '4px' }}>{catLabel}:</span>
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{f.query}</span>
              <button
                type="button"
                ref={el => { removeRefs.current[i] = el; }}
                onClick={() => handleRemoveFilter(i)}
                aria-label={`Quitar filtro ${catLabel}: ${f.query}`}
                style={{ background: 'transparent', border: 'none', color: '#ff6b6b', marginLeft: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ×
              </button>
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
