import { NavLink } from 'react-router';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAdmin } from '../context/AdminContext';

// Enlace para saltar la navegación (WCAG 2.4.1).
export function SkipLink() {
  return <a href="#contenido" className="skip-link">Saltar al contenido</a>;
}

// Menú principal de la aplicación.
export function MainNav() {
  const { isAdmin, isEditMode, setIsEditMode, user } = useAdmin();
  return (
      <nav style={{ padding: '1rem', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <p className="marca" style={{ margin: 0, marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          PRETSO
          {user && (
            <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: 'var(--text-secondary, #aaa)' }}>
              ({user.email})
            </span>
          )}
        </p>
        <NavLink to="/" state={{ reset: Date.now() }}>Inicio</NavLink>
        <NavLink to="/caja" state={{ reset: Date.now() }}>Manejo de Caja</NavLink>
        <NavLink to="/salarios" state={{ reset: Date.now() }}>Remuneraciones</NavLink>
        <NavLink to="/corpus" state={{ reset: Date.now() }}>Corpus Christi</NavLink>
        <NavLink to="/indicadores" state={{ reset: Date.now() }}>Identificación de Indicadores</NavLink>
        <NavLink to="/companias" state={{ reset: Date.now() }}>Compañías</NavLink>
        <NavLink to="/bibliografia" state={{ reset: Date.now() }}>Bibliografía</NavLink>
        
        {isAdmin && (
          <>
            <span style={{ borderLeft: '1px solid var(--border-color)', height: '24px', margin: '0 0.5rem' }}></span>
            <NavLink to="/transacciones" style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>Transacciones</NavLink>
            <NavLink to="/documentos" style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>Documentos</NavLink>
            
            <NavLink to="/administracion" style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>Administración</NavLink>

            <button 
              onClick={() => setIsEditMode(!isEditMode)} 
              style={{ 
                padding: '0.4rem 1rem', 
                background: isEditMode ? '#ff6b6b' : 'var(--primary-color)',
                color: isEditMode ? 'var(--on-danger)' : 'var(--on-primary)',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {isEditMode ? 'SALIR EDICIÓN' : 'EDICIÓN'}
            </button>
          </>
        )}
        
        <button onClick={() => signOut(auth)} style={{ padding: '0.4rem 1rem', marginLeft: isAdmin ? '0' : 'auto' }}>Salir</button>
      </nav>
  );
}
