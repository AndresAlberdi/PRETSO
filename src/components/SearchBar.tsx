import { useState } from 'react';

interface SearchCategory {
  id: string;
  label: string;
}

interface SearchBarProps {
  onSearch: (category: string, query: string) => void;
  categories: SearchCategory[];
}

export default function SearchBar({ onSearch, categories }: SearchBarProps) {
  const [category, setCategory] = useState(categories[0]?.id || '');
  const [query, setQuery] = useState('');

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(category, query);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('', '');
  };

  return (
    <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
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
        placeholder="Buscar..."
        style={{ padding: '0.5rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
      />
      <button type="submit" style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: '#111', border: 'none', borderRadius: '4px', fontWeight: 'bold' }}>
        Buscar
      </button>
      {query && (
        <button type="button" onClick={handleClear} style={{ padding: '0.5rem 1rem', background: 'transparent', color: 'white', border: '1px solid var(--border-color)', borderRadius: '4px' }}>
          X
        </button>
      )}
    </form>
  );
}
