import { useState, useMemo, useEffect } from "react";
import { collection, getDocs, query } from "firebase/firestore";
import { db } from "../firebase";
import { cleanFirebaseData } from "../utils";
import SearchBar, { type SearchFilter } from "../components/SearchBar";
import { useNavigate, Link } from "react-router";
import { useAdmin } from "../context/AdminContext";
import { SECCIONES } from "../utils/secciones";
import { contar } from "../utils/anuncios";

type SearchResultItem = {
  id: string;
  source: string;
  label: string;
  match: string;
  data: any;
  path: string;
};

export default function Busqueda() {
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<SearchFilter[]>([]);
  const [dbData, setDbData] = useState<{ [key: string]: any[] }>({});
  const [loadError, setLoadError] = useState('');
  const { isAdmin, adminLoading } = useAdmin();
  
  const navigate = useNavigate();

  const searchCategories = [
    { id: 'Persona', label: 'Persona' },
    { id: 'Ciudad', label: 'Ciudad' },
    { id: 'Año', label: 'Año' },
    { id: 'all', label: 'Texto libre' }
  ];

  // Pre-load data to allow quick searching
  useEffect(() => {
    if (adminLoading) return;
    async function loadAllData() {
      setLoading(true);
      setLoadError('');
      const collections = [
        "manejo_de_caja", "salarios", "corpus_christi",
        "indicadores", "companias", "bibliografia",
        ...(isAdmin ? ["transacciones", "documentos"] : [])
      ];
      const dataMap: { [key: string]: any[] } = {};

      try {
        await Promise.all(collections.map(async (collName) => {
          const q = query(collection(db, collName));
          const snap = await getDocs(q);
          dataMap[collName] = snap.docs.map(cleanFirebaseData);
        }));
        setDbData(dataMap);
      } catch (error) {
        console.error('No se pudo cargar la base para la búsqueda:', (error as { code?: string })?.code);
        setLoadError('No se pudo cargar la base de datos para la búsqueda. Inténtelo de nuevo más tarde.');
      } finally {
        setLoading(false);
      }
    }
    loadAllData();
  }, [isAdmin, adminLoading]);

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
        salarios: 'Remuneraciones',
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
        <h1 className="titulo-busqueda">Búsqueda general</h1>
        
        <div style={{ display: 'inline-block', textAlign: 'left', minWidth: 'min(300px, 100%)', maxWidth: '600px', width: '100%' }}>
          <SearchBar 
            onSearch={(f) => setFilters(f)} 
            categories={searchCategories} 
          />
        </div>
      </div>

      <output aria-live="polite" className="visually-hidden">
        {!loading && filters.length > 0
          ? (searchResults.length === 0
            ? 'Búsqueda sin resultados'
            : `Búsqueda: ${contar(searchResults.length, 'resultado', 'resultados')}`)
          : ''}
      </output>

      {loadError && <p role="alert">{loadError}</p>}

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
                  alignItems: 'center',
                  gap: '1rem',
                  flexWrap: 'wrap'
                }}>
                  <div style={{ flex: '1 1 12rem', minWidth: 0, overflowWrap: 'anywhere' }}>
                    <span style={{ 
                      background: 'var(--primary-color)', 
                      color: 'var(--on-primary)', 
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
                    style={{ background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '0.4rem 1rem', borderRadius: '4px', cursor: 'pointer', flexShrink: 0, maxWidth: '100%' }}
                  >
                    Ir a la sección
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="rotulo-secciones">Secciones</p>
      <nav aria-label="Secciones de la base de datos">
        <ol className="lista-secciones">
          {SECCIONES.map((s, i) => (
            <li key={s.ruta}><Link to={s.ruta} className="fila-seccion">
              <span className="numero-seccion">{i + 1}</span>
              <span className="nombre-seccion">{s.nombre}</span>
              <svg className="flecha-seccion" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </Link></li>
          ))}
        </ol>
      </nav>
    </div>
  );
}
