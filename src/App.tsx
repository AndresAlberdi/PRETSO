import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
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
import { AdminProvider } from './context/AdminContext';
import RouteEffects from './components/RouteEffects';
import { SkipLink, MainNav } from './components/MainNav';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SkipLink />
      <MainNav />

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
