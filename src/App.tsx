import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, useLocation } from 'react-router';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import Login from './pages/Login';
import Inicio from './pages/Inicio';
import ManejoCaja from './pages/ManejoCaja';
import Salarios from './pages/Salarios';
import CorpusChristi from './pages/CorpusChristi';
import Indicadores from './pages/Indicadores';
import IndiceCompanias from './pages/IndiceCompanias';
import Bibliografia from './pages/Bibliografia';
import Transacciones from './pages/Transacciones';
import Documentos from './pages/Documentos';
import Auditoria from './pages/Auditoria';
import Administracion from './pages/Administracion';
import UserManagement from './pages/UserManagement';
import './index.css';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';
import { AdminProvider, useAdmin } from './context/AdminContext';
import { pageTitle } from './utils/pageTitle';

// Ruta anterior (módulo, no estado): permite distinguir la primera carga de un cambio de ruta
// aunque Layout se vuelva a montar entre rutas.
let rutaAnterior: string | null = null;

// Asigna el título del documento (2.4.2) y, al cambiar de ruta, lleva el foco al contenido (2.4.1/2.4.3).
function RouteEffects() {
  const { pathname } = useLocation();
  useEffect(() => {
    document.title = pageTitle(pathname);
    if (rutaAnterior !== null && rutaAnterior !== pathname) {
      document.getElementById('contenido')?.focus({ preventScroll: true });
    }
    rutaAnterior = pathname;
  }, [pathname]);
  return null;
}



function Layout({ children }: { children: React.ReactNode }) {
  const { isAdmin, isEditMode, setIsEditMode, user } = useAdmin();
  return (
    <div>
      <a href="#contenido" className="skip-link">Saltar al contenido</a>
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



      <main id="contenido" tabIndex={-1} style={{ padding: '2rem' }}>
        {children}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AdminProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<Login />} />
          
          <Route path="/" element={<ProtectedRoute><Layout><Inicio /></Layout></ProtectedRoute>} />
          <Route path="/caja" element={<ProtectedRoute><Layout><ManejoCaja /></Layout></ProtectedRoute>} />
          <Route path="/salarios" element={<ProtectedRoute><Layout><Salarios /></Layout></ProtectedRoute>} />
          <Route path="/corpus" element={<ProtectedRoute><Layout><CorpusChristi /></Layout></ProtectedRoute>} />
          <Route path="/indicadores" element={<ProtectedRoute><Layout><Indicadores /></Layout></ProtectedRoute>} />
          <Route path="/companias" element={<ProtectedRoute><Layout><IndiceCompanias /></Layout></ProtectedRoute>} />
          <Route path="/bibliografia" element={<ProtectedRoute><Layout><Bibliografia /></Layout></ProtectedRoute>} />
          <Route path="/transacciones" element={<ProtectedRoute><Layout><Transacciones /></Layout></ProtectedRoute>} />
          <Route path="/documentos" element={<ProtectedRoute><Layout><Documentos /></Layout></ProtectedRoute>} />
          <Route path="/auditoria" element={<ProtectedRoute><AdminRoute><Layout><Auditoria /></Layout></AdminRoute></ProtectedRoute>} />
          <Route path="/administracion" element={<ProtectedRoute><AdminRoute><Layout><Administracion /></Layout></AdminRoute></ProtectedRoute>} />
          <Route path="/usuarios" element={<ProtectedRoute><AdminRoute><Layout><UserManagement /></Layout></AdminRoute></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <RouteEffects />
      </Router>
    </AdminProvider>
  );
}
