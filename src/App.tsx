import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import ProtectedRoute from './components/ProtectedRoute';
import AdminRoute from './components/AdminRoute';
import ReaderRoute from './components/ReaderRoute';
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
import EditModeRouteReset from './components/EditModeRouteReset';
import { SkipLink, MainNav } from './components/MainNav';

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <SkipLink />
      <MainNav />

      <main id="contenido" tabIndex={-1} className="contenido-principal">
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
          
          <Route path="/" element={<ProtectedRoute><ReaderRoute><Layout><Inicio /></Layout></ReaderRoute></ProtectedRoute>} />
          <Route path="/caja" element={<ProtectedRoute><ReaderRoute><Layout><ManejoCaja /></Layout></ReaderRoute></ProtectedRoute>} />
          <Route path="/salarios" element={<ProtectedRoute><ReaderRoute><Layout><Salarios /></Layout></ReaderRoute></ProtectedRoute>} />
          <Route path="/corpus" element={<ProtectedRoute><ReaderRoute><Layout><CorpusChristi /></Layout></ReaderRoute></ProtectedRoute>} />
          <Route path="/indicadores" element={<ProtectedRoute><ReaderRoute><Layout><Indicadores /></Layout></ReaderRoute></ProtectedRoute>} />
          <Route path="/companias" element={<ProtectedRoute><ReaderRoute><Layout><IndiceCompanias /></Layout></ReaderRoute></ProtectedRoute>} />
          <Route path="/bibliografia" element={<ProtectedRoute><ReaderRoute><Layout><Bibliografia /></Layout></ReaderRoute></ProtectedRoute>} />
          <Route path="/transacciones" element={<ProtectedRoute><ReaderRoute><Layout><Transacciones /></Layout></ReaderRoute></ProtectedRoute>} />
          <Route path="/documentos" element={<ProtectedRoute><ReaderRoute><Layout><Documentos /></Layout></ReaderRoute></ProtectedRoute>} />
          <Route path="/auditoria" element={<ProtectedRoute><ReaderRoute><AdminRoute><Layout><Auditoria /></Layout></AdminRoute></ReaderRoute></ProtectedRoute>} />
          <Route path="/administracion" element={<ProtectedRoute><ReaderRoute><AdminRoute><Layout><Administracion /></Layout></AdminRoute></ReaderRoute></ProtectedRoute>} />
          <Route path="/usuarios" element={<ProtectedRoute><ReaderRoute><AdminRoute><Layout><UserManagement /></Layout></AdminRoute></ReaderRoute></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <RouteEffects />
        <EditModeRouteReset />
      </Router>
    </AdminProvider>
  );
}
