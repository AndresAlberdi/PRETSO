import { useState } from 'react';

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
  const [filters, setFilters] = useState<SearchFilter[]>([]);

  const handleAddFilter = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    
    const catToUse = category || categories[0]?.id || '';
    const newFilters = [...filters, { category: catToUse, query: query.trim() }];
    setFilters(newFilters);
    setQuery('');
    onSearch(newFilters);
  };

  const handleRemoveFilter = (index: number) => {
    const newFilters = filters.filter((_, i) => i !== index);
    setFilters(newFilters);
    onSearch(newFilters);
  };

  const handleClearAll = () => {
    setFilters([]);
    setQuery('');
    onSearch([]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
      <form onSubmit={handleAddFilter} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
        <select 
          value={category} 
          onChange={e => setCategory(e.target.value)}
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
        >
          {categories.map(c => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <input 
          type="text" 
          value={query} 
          onChange={e => setQuery(e.target.value)} 
          placeholder="Añadir filtro..."
          style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
        />
        <button type="submit" style={{ padding: '0.5rem 1rem', background: 'transparent', color: 'var(--primary-color)', border: '1px solid var(--primary-color)', borderRadius: '4px', fontWeight: 'bold' }}>
          Agregar
        </button>
        <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: '#111', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
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
          {filters.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '16px', fontSize: '0.85rem' }}>
              <span style={{ color: 'var(--primary-color)', marginRight: '4px' }}>{categories.find(c => c.id === f.category)?.label || f.category}:</span>
              <span>{f.query}</span>
              <button 
                type="button" 
                onClick={() => handleRemoveFilter(i)}
                style={{ background: 'transparent', border: 'none', color: '#ff6b6b', marginLeft: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
