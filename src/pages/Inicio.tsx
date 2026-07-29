import { useState, useMemo, useEffect } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../firebase";
import { cleanFirebaseData } from "../utils";
import SearchBar, { type SearchFilter } from "../components/SearchBar";
import { useNavigate } from "react-router";

type SearchResultItem = {
  id: string;
  source: string;
  label: string;
  match: string;
  data: any;
  path: string;
};

export default function Inicio() {
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFilter[]>([]);
  const [dbData, setDbData] = useState<{ [key: string]: any[] }>({});
  
  const navigate = useNavigate();

  const searchCategories = [
    { id: 'Persona', label: 'Persona' },
    { id: 'Ciudad', label: 'Ciudad' },
    { id: 'Año', label: 'Año' },
    { id: 'all', label: 'Texto libre' }
  ];

  // Pre-load data to allow quick searching
  useEffect(() => {
    async function loadAllData() {
      setLoading(true);
      const collections = [
        "manejo_de_caja", "salarios", "corpus_christi", 
        "indicadores", "companias", "bibliografia", 
        "transacciones", "documentos"
      ];
      const dataMap: { [key: string]: any[] } = {};
      
      await Promise.all(collections.map(async (collName) => {
        const q = query(collection(db, collName));
        const snap = await getDocs(q);
        dataMap[collName] = snap.docs.map(cleanFirebaseData);
      }));
      
      setDbData(dataMap);
      setLoading(false);
    }
    loadAllData();
  }, []);

  const searchResults = useMemo(() => {
    if (filters.length === 0 || Object.keys(dbData).length === 0) return [];
    
    let results: SearchResultItem[] = [];

    const getPersonaFields = (data: any, coll: string) => {
      if (coll === 'companias') return [data["Autores"], data["Nombre Compañía"], data["Sigla Compañía"]];
      if (coll === 'salarios') return [data["Beneficiario "]];
      if (coll === 'corpus_christi') return [data["Encargado "]];
      if (coll === 'bibliografia') return [data["Autores"]];
      return [];
    };

    const getPath = (coll: string) => {
      switch (coll) {
        case 'manejo_de_caja': return '/caja';
        case 'salarios': return '/salarios';
        case 'corpus_christi': return '/corpus';
        case 'indicadores': return '/indicadores';
        case 'companias': return '/companias';
        case 'bibliografia': return '/bibliografia';
        case 'transacciones': return '/transacciones';
        case 'documentos': return '/documentos';
        default: return '/';
      }
    };

    const getLabel = (coll: string) => {
      const labels: Record<string, string> = {
        manejo_de_caja: 'Manejo de Caja',
        salarios: 'Salarios',
        corpus_christi: 'Corpus Christi',
        indicadores: 'Indicadores',
        companias: 'Compañías',
        bibliografia: 'Bibliografía',
        transacciones: 'Transacciones',
        documentos: 'Documentos'
      };
      return labels[coll] || coll;
    };

    const checkMatch = (data: any, coll: string, filter: SearchFilter) => {
      const q = filter.query.toLowerCase();
      
      if (filter.category === 'all') {
        return Object.values(data).some(v => String(v).toLowerCase().includes(q));
      }
      
      if (filter.category === 'Persona') {
        const fields = getPersonaFields(data, coll);
        return fields.some(f => f && String(f).toLowerCase().includes(q));
      }

      if (filter.category === 'Ciudad') {
        return data["Ciudad"] && String(data["Ciudad"]).toLowerCase().includes(q);
      }

      if (filter.category === 'Año') {
        return (data["Año"] && String(data["Año"]).toLowerCase().includes(q)) || 
               (data["Años"] && String(data["Años"]).toLowerCase().includes(q)) ||
               (data["Temporadas teatrales"] && String(data["Temporadas teatrales"]).toLowerCase().includes(q));
      }
      
      return false;
    };

    for (const [coll, items] of Object.entries(dbData)) {
      for (const item of items) {
        // Must match ALL filters
        const matchesAll = filters.every(f => checkMatch(item, coll, f));
        if (matchesAll) {
          // Construct a display string
          const vals = Object.entries(item)
            .filter(([k, v]) => k !== 'id' && v)
            .map(([k, v]) => `${k}: ${v}`);
          const matchStr = vals.slice(0, 3).join(" | ");

          results.push({
            id: item.id,
            source: coll,
            label: getLabel(coll),
            match: matchStr + (vals.length > 3 ? '...' : ''),
            data: item,
            path: getPath(coll)
          });
        }
      }
    }

    return results;
  }, [filters, dbData]);

  return (
    <div>
      <div style={{ textAlign: 'center', margin: '2rem 0' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: 'var(--primary-color)' }}>PRETSO</h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
          Plataforma de Registros Teatrales y Sonoros
        </p>
        
        <div style={{ display: 'inline-block', textAlign: 'left', minWidth: '300px', maxWidth: '600px', width: '100%' }}>
          <SearchBar 
            onSearch={(f) => setFilters(f)} 
            categories={searchCategories} 
          />
        </div>
      </div>

      {loading && <div style={{ textAlign: 'center', marginTop: '2rem' }}>Cargando base de datos para búsqueda...</div>}

      {!loading && filters.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h2>Resultados de Búsqueda ({searchResults.length})</h2>
          {searchResults.length === 0 ? (
            <p>No se encontraron resultados que coincidan con su búsqueda.</p>
          ) : (
            <div style={{ display: 'grid', gap: '1rem' }}>
              {searchResults.map(res => (
                <div key={`${res.source}-${res.id}`} style={{ 
                  background: 'var(--bg-card)', 
                  border: '1px solid var(--border-color)', 
                  padding: '1rem', 
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <span style={{ 
                      background: 'var(--primary-color)', 
                      color: 'white', 
                      padding: '0.2rem 0.5rem', 
                      borderRadius: '4px', 
                      fontSize: '0.8rem', 
                      fontWeight: 'bold',
                      marginRight: '1rem' 
                    }}>
                      {res.label}
                    </span>
                    <span style={{ color: 'var(--text-primary)' }}>{res.match}</span>
                  </div>
                  <button 
                    onClick={() => navigate(res.path)}
                    style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer' }}
                  >
                    Ir a la sección
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
