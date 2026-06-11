import { BrowserRouter, Routes, Route } from 'react-router-dom'
import NavBar from './components/NavBar'
import { AuthProvider } from './contexts/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'

// Public pages
import Home from './pages/public/Home'
import UserHome from './pages/public/UserHome'
import Search from './pages/public/Search'
import Announcements from './pages/public/Announcements'
import CompanyDetail from './pages/public/CompanyDetail'
import TransactionDetail from './pages/public/TransactionDetail'
import ApiDocs from './pages/public/ApiDocs'
import Login from './pages/public/Login'
import Register from './pages/public/Register'
import ChangePassword from './pages/public/ChangePassword'
import TableRecordsList from './pages/public/TableRecordsList'
import IndicadoresPage from './pages/public/IndicadoresPage'

// Admin pages
import Dashboard from './pages/admin/Dashboard'
import RecordEditor from './pages/admin/RecordEditor'
import RecordsList from './pages/admin/RecordsList'
import EtlUpload from './pages/admin/EtlUpload'
import BulkImport from './pages/admin/BulkImport'
import UserManagement from './pages/admin/UserManagement'
import AnnouncementsManagement from './pages/admin/AnnouncementsManagement'

import CompaniesList from './pages/public/CompaniesList'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <NavBar />
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route path="/user-home" element={<UserHome />} />
            <Route path="/caja" element={<TableRecordsList sourceTable="CM" title="Compañía — Manejo de Caja" />} />
            <Route path="/salarios" element={<TableRecordsList sourceTable="CS" title="Compañía — Salarios" />} />
            <Route path="/corpus-christi" element={<TableRecordsList sourceTable="CC" title="Corpus Christi" />} />
            <Route path="/bibliografia" element={<TableRecordsList sourceTable="B" title="Bibliografía" />} />
            <Route path="/indicadores" element={<IndicadoresPage />} />
            
            <Route path="/search" element={<Search />} />
            <Route path="/companies" element={<CompaniesList />} />
            <Route path="/companies/:id" element={<CompanyDetail />} />
            <Route path="/transactions/:id" element={<TransactionDetail />} />
            <Route path="/announcements" element={<Announcements />} />
            <Route path="/api-docs" element={<ApiDocs />} />
            <Route path="/change-password" element={<ChangePassword />} />
            
            {/* Admin routes */}
            <Route path="/admin" element={<Dashboard />} />
            <Route path="/admin/records" element={<RecordsList />} />
            <Route path="/admin/records/new" element={<RecordEditor />} />
            <Route path="/admin/records/:id" element={<RecordEditor />} />
            <Route path="/admin/etl" element={<EtlUpload />} />
            <Route path="/admin/bulk-import" element={<BulkImport />} />
            <Route path="/admin/users" element={<UserManagement />} />
            <Route path="/admin/announcements" element={<AnnouncementsManagement />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
