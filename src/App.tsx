import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import ProtectedRoute from './components/ProtectedRoute';
import HomeRoute from './components/HomeRoute';
import AdminRoute from './components/AdminRoute';
import ReaderRoute from './components/ReaderRoute';
import PublicReadRoute from './components/PublicReadRoute';
import Portada from './pages/Portada';
import Busqueda from './pages/Busqueda';
import ManejoCaja from './pages/ManejoCaja';
import Salarios from './pages/Salarios';
import CorpusChristi from './pages/CorpusChristi';
import Indicadores from './pages/Indicadores';
import IndiceCompanias from './pages/IndiceCompanias';
import Bibliografia from './pages/Bibliografia';
import AgregarTransaccion from './pages/AgregarTransaccion';
import Transacciones from './pages/Transacciones';
import Documentos from './pages/Documentos';
import Auditoria from './pages/Auditoria';
import PaginaLegal from './pages/PaginaLegal';
import Administracion from './pages/Administracion';
import UserManagement from './pages/UserManagement';
import './index.css';
import { AdminProvider } from './context/AdminContext';
import RouteEffects from './components/RouteEffects';
import EditModeRouteReset from './components/EditModeRouteReset';
import { SkipLink } from './components/SkipLink';
import { TopBar } from './components/TopBar';
import { PiePagina } from './components/PiePagina';

const ATRAS_BUSCAR = <TopBar conservarBusqueda volver={{ to: '/buscar', texto: 'Atrás' }} />;
const ATRAS_ADMIN = <TopBar volver={{ to: '/administracion', texto: 'Atrás' }} />;
const ATRAS_INICIO = <TopBar volver={{ to: '/', texto: 'Inicio' }} />;
const ATRAS_AGREGAR = <TopBar volver={{ to: '/agregar', texto: 'Atrás' }} />;

function Layout({ barra, children }: { barra: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <SkipLink />
      {barra}

      <main id="contenido" tabIndex={-1} className="contenido-principal">
        {children}
      </main>
      <PiePagina />
    </div>
  );
}

export default function App() {
  return (
    <AdminProvider>
      <Router>
        <RouteEffects />
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          
          <Route path="/" element={<HomeRoute signedOut={<Layout barra={<TopBar />}><Portada modo="visitante" /></Layout>} signedIn={<ReaderRoute><Layout barra={<TopBar conCuenta />}><Portada modo="sesion" /></Layout></ReaderRoute>} />} />
          <Route path="/buscar" element={<PublicReadRoute><Layout barra={<TopBar conAgregar volver={{ to: '/', texto: 'Inicio' }} />}><Busqueda /></Layout></PublicReadRoute>} />
          <Route path="/caja" element={<PublicReadRoute><Layout barra={ATRAS_BUSCAR}><ManejoCaja /></Layout></PublicReadRoute>} />
          <Route path="/salarios" element={<PublicReadRoute><Layout barra={ATRAS_BUSCAR}><Salarios /></Layout></PublicReadRoute>} />
          <Route path="/corpus" element={<PublicReadRoute><Layout barra={ATRAS_BUSCAR}><CorpusChristi /></Layout></PublicReadRoute>} />
          <Route path="/indicadores" element={<PublicReadRoute><Layout barra={ATRAS_BUSCAR}><Indicadores /></Layout></PublicReadRoute>} />
          <Route path="/companias" element={<PublicReadRoute><Layout barra={ATRAS_BUSCAR}><IndiceCompanias /></Layout></PublicReadRoute>} />
          <Route path="/bibliografia" element={<PublicReadRoute><Layout barra={ATRAS_BUSCAR}><Bibliografia /></Layout></PublicReadRoute>} />
          <Route path="/agregar" element={<ProtectedRoute><ReaderRoute><AdminRoute><Layout barra={ATRAS_BUSCAR}><AgregarTransaccion /></Layout></AdminRoute></ReaderRoute></ProtectedRoute>} />
          <Route path="/transacciones" element={<ProtectedRoute><ReaderRoute><AdminRoute><Layout barra={ATRAS_AGREGAR}><Transacciones /></Layout></AdminRoute></ReaderRoute></ProtectedRoute>} />
          <Route path="/documentos" element={<ProtectedRoute><ReaderRoute><AdminRoute><Layout barra={ATRAS_AGREGAR}><Documentos /></Layout></AdminRoute></ReaderRoute></ProtectedRoute>} />
          <Route path="/auditoria" element={<ProtectedRoute><ReaderRoute><AdminRoute><Layout barra={ATRAS_ADMIN}><Auditoria /></Layout></AdminRoute></ReaderRoute></ProtectedRoute>} />
          <Route path="/administracion" element={<ProtectedRoute><ReaderRoute><AdminRoute><Layout barra={<TopBar volver={{ to: '/', texto: 'Inicio' }} />}><Administracion /></Layout></AdminRoute></ReaderRoute></ProtectedRoute>} />
          <Route path="/usuarios" element={<ProtectedRoute><ReaderRoute><AdminRoute><Layout barra={ATRAS_ADMIN}><UserManagement /></Layout></AdminRoute></ReaderRoute></ProtectedRoute>} />
          <Route path="/aviso-legal" element={<Layout barra={ATRAS_INICIO}><PaginaLegal ruta="/aviso-legal" /></Layout>} />
          <Route path="/privacidad" element={<Layout barra={ATRAS_INICIO}><PaginaLegal ruta="/privacidad" /></Layout>} />
          <Route path="/cookies" element={<Layout barra={ATRAS_INICIO}><PaginaLegal ruta="/cookies" /></Layout>} />
          <Route path="/accesibilidad" element={<Layout barra={ATRAS_INICIO}><PaginaLegal ruta="/accesibilidad" /></Layout>} />
          <Route path="/creditos" element={<Layout barra={ATRAS_INICIO}><PaginaLegal ruta="/creditos" /></Layout>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <EditModeRouteReset />
      </Router>
    </AdminProvider>
  );
}
