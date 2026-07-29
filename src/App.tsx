import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router';
import ProtectedRoute from './components/ProtectedRoute';
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



function Layout({ children }: { children: React.ReactNode }) {
  const { isAdmin, isEditMode, setIsEditMode, user } = useAdmin();
  return (
    <div>
      <nav style={{ padding: '1rem', background: 'var(--bg-card)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <h2 style={{ margin: 0, marginRight: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          PRETSO
          {user && (
            <span style={{ fontSize: '0.9rem', fontWeight: 'normal', color: 'var(--text-secondary, #aaa)' }}>
              ({user.email})
            </span>
          )}
        </h2>
        <Link to="/" state={{ reset: Date.now() }}>Inicio</Link>
        <Link to="/caja" state={{ reset: Date.now() }}>Manejo de Caja</Link>
        <Link to="/salarios" state={{ reset: Date.now() }}>Salarios</Link>
        <Link to="/corpus" state={{ reset: Date.now() }}>Corpus Christi</Link>
        <Link to="/indicadores" state={{ reset: Date.now() }}>Identificación de Indicadores</Link>
        <Link to="/companias" state={{ reset: Date.now() }}>Compañías</Link>
        <Link to="/bibliografia" state={{ reset: Date.now() }}>Bibliografía</Link>
        
        {isAdmin && (
          <>
            <span style={{ borderLeft: '1px solid var(--border-color)', height: '24px', margin: '0 0.5rem' }}></span>
            <Link to="/transacciones" style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>Transacciones</Link>
            <Link to="/documentos" style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>Documentos</Link>
            
            <Link to="/administracion" style={{ color: 'var(--primary-color)', fontWeight: 'bold' }}>Administración</Link>

            <button 
              onClick={() => setIsEditMode(!isEditMode)} 
              style={{ 
                padding: '0.4rem 1rem', 
                background: isEditMode ? '#ff6b6b' : 'var(--primary-color)',
                color: 'white',
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



      <main style={{ padding: '2rem' }}>
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
          <Route path="/auditoria" element={<ProtectedRoute><Layout><Auditoria /></Layout></ProtectedRoute>} />
          <Route path="/administracion" element={<ProtectedRoute><Layout><Administracion /></Layout></ProtectedRoute>} />
          <Route path="/usuarios" element={<ProtectedRoute><Layout><UserManagement /></Layout></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AdminProvider>
  );
}
