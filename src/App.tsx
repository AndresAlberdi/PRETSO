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
import UserManagement from './pages/UserManagement';
import './index.css';
import { auth } from './firebase';
import { signOut } from 'firebase/auth';
import { AdminProvider, useAdmin } from './context/AdminContext';

import { useState, useRef, useEffect } from 'react';
import { generateDatabaseXml, downloadXml, generateZipBlob, uploadToGoogleDrive } from './utils/backup';
import { generateDatabaseXlsx, downloadXlsx } from './utils/xlsxExport';

function Layout({ children }: { children: React.ReactNode }) {
  const { isAdmin, isEditMode, setIsEditMode, user } = useAdmin();
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setAdminMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  const [configuringClientId, setConfiguringClientId] = useState(false);
  const [clientId, setClientId] = useState(() => localStorage.getItem('google_client_id') || '');
  const [backupStatus, setBackupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  const handleDownloadXml = async () => {
    try {
      setBackupStatus('loading');
      setStatusMessage('Generando volcado de base de datos XML...');
      const xml = await generateDatabaseXml();
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const formattedDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      downloadXml(xml, `pretso_database_${formattedDate}.xml`);
      setBackupStatus('success');
      setStatusMessage('¡Volcado XML descargado exitosamente!');
      setTimeout(() => setBackupStatus('idle'), 3000);
    } catch (err: any) {
      console.error(err);
      setBackupStatus('error');
      setStatusMessage(`Error al generar XML: ${err.message || err}`);
    }
  };

  const handleDownloadXlsx = async () => {
    try {
      setBackupStatus('loading');
      setStatusMessage('Generando volcado de base de datos XLSX...');
      const blob = await generateDatabaseXlsx();
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const formattedDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
      downloadXlsx(blob, `pretso_database_${formattedDate}.xlsx`);
      setBackupStatus('success');
      setStatusMessage('¡Volcado XLSX descargado exitosamente!');
      setTimeout(() => setBackupStatus('idle'), 3000);
    } catch (err: any) {
      console.error(err);
      setBackupStatus('error');
      setStatusMessage(`Error al generar XLSX: ${err.message || err}`);
    }
  };

  const handleGoogleDriveBackup = async () => {
    if (!clientId) {
      setConfiguringClientId(true);
      return;
    }

    try {
      setBackupStatus('loading');
      setStatusMessage('Iniciando autorización con Google...');

      const google = (window as any).google;
      if (!google || !google.accounts || !google.accounts.oauth2) {
        throw new Error('La API de Google no se cargó correctamente. Verifique su conexión.');
      }

      const client = google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: 'https://www.googleapis.com/auth/drive.file',
        callback: async (tokenResponse: any) => {
          if (tokenResponse.error) {
            setBackupStatus('error');
            setStatusMessage(`Error de autorización Google: ${tokenResponse.error_description || tokenResponse.error}`);
            return;
          }

          if (tokenResponse.access_token) {
            try {
              setBackupStatus('loading');
              setStatusMessage('Generando volcado XML y comprimiendo a ZIP...');
              
              const xml = await generateDatabaseXml();
              const now = new Date();
              const pad = (n: number) => String(n).padStart(2, '0');
              const formattedDate = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
              const zipFilename = `backup_${formattedDate}.zip`;
              const xmlFilename = `pretso_database_${formattedDate}.xml`;

              const zipBlob = await generateZipBlob(xml, xmlFilename);

              setStatusMessage('Guardando en Google Drive...');
              const fileId = await uploadToGoogleDrive(zipBlob, zipFilename, tokenResponse.access_token);

              setBackupStatus('success');
              setStatusMessage(`¡Copia de seguridad guardada con éxito en Google Drive! (ID de archivo: ${fileId})`);
            } catch (uploadErr: any) {
              console.error(uploadErr);
              setBackupStatus('error');
              setStatusMessage(`Error al guardar en Google Drive: ${uploadErr.message || uploadErr}`);
            }
          }
        }
      });

      client.requestAccessToken({ login_hint: 'pretsodatabase@gmail.com' });

    } catch (err: any) {
      console.error(err);
      setBackupStatus('error');
      setStatusMessage(`Error al iniciar backup: ${err.message || err}`);
    }
  };

  const saveClientId = (id: string) => {
    localStorage.setItem('google_client_id', id);
    setClientId(id);
    setConfiguringClientId(false);
  };

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
            
            <div style={{ position: 'relative' }} ref={menuRef}>
              <button 
                onClick={() => setAdminMenuOpen(!adminMenuOpen)} 
                style={{ 
                  padding: '0.4rem 1rem', 
                  background: 'var(--bg-body, #222)',
                  color: 'var(--text-primary, #fff)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                Administración ▾
              </button>
              {adminMenuOpen && (
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: '110%',
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '4px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                  display: 'flex',
                  flexDirection: 'column',
                  minWidth: '220px',
                  zIndex: 1000
                }}>
                  <Link 
                    to="/auditoria" 
                    onClick={() => setAdminMenuOpen(false)}
                    style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border-color)', textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 'bold' }}
                  >
                    Auditoría (Logs)
                  </Link>
                  <Link 
                    to="/usuarios" 
                    onClick={() => setAdminMenuOpen(false)}
                    style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border-color)', textDecoration: 'none', color: 'var(--text-primary)', fontWeight: 'bold' }}
                  >
                    Gestión de Usuarios
                  </Link>
                  <button 
                    onClick={() => { setAdminMenuOpen(false); handleDownloadXml(); }}
                    style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)', width: '100%', fontSize: '1rem', fontWeight: 'bold' }}
                  >
                    Descargar XML
                  </button>
                  <button 
                    onClick={() => { setAdminMenuOpen(false); handleDownloadXlsx(); }}
                    style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)', width: '100%', fontSize: '1rem', fontWeight: 'bold' }}
                  >
                    Descargar XLSX
                  </button>
                  <button 
                    onClick={() => { setAdminMenuOpen(false); handleGoogleDriveBackup(); }}
                    style={{ padding: '0.8rem 1rem', borderBottom: '1px solid var(--border-color)', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text-primary)', width: '100%', fontSize: '1rem', fontWeight: 'bold' }}
                  >
                    Copia a Google Drive
                  </button>
                  <button 
                    onClick={() => { setAdminMenuOpen(false); setConfiguringClientId(true); }}
                    style={{ padding: '0.8rem 1rem', background: 'none', border: 'none', textAlign: 'left', cursor: 'pointer', color: 'var(--text-secondary, #aaa)', width: '100%', fontSize: '0.9rem' }}
                  >
                    ⚙ Configurar Client ID
                  </button>
                </div>
              )}
            </div>

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

      {/* Popups and modals for backups */}
      {configuringClientId && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
          <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '8px', maxWidth: '500px', width: '90%', border: '1px solid var(--border-color)' }}>
            <h3 style={{ marginTop: 0 }}>Configurar Google Client ID</h3>
            <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary, #aaa)', lineHeight: '1.4' }}>
              Para guardar copias de seguridad en Google Drive de forma segura, ingrese su <strong>Google OAuth Client ID</strong> de la consola de desarrolladores. Asegúrese de registrar el origen JavaScript correspondiente (ej: <code>http://localhost:5173</code>).
            </p>
            <input 
              type="text" 
              placeholder="XXXXXXXXXXXX-XXXXXXXXXXXXXXXX.apps.googleusercontent.com" 
              defaultValue={clientId}
              id="clientIdInputField"
              style={{ width: '100%', padding: '0.5rem', marginBottom: '1.5rem', background: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '4px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
              <button onClick={() => setConfiguringClientId(false)} style={{ padding: '0.5rem 1rem', background: '#ccc', color: '#333', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
              <button 
                onClick={() => {
                  const input = document.getElementById('clientIdInputField') as HTMLInputElement;
                  saveClientId(input ? input.value.trim() : '');
                }} 
                style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {backupStatus !== 'idle' && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
          <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '8px', maxWidth: '400px', width: '90%', border: '1px solid var(--border-color)', textAlign: 'center' }}>
            {backupStatus === 'loading' && (
              <>
                <h3 style={{ marginTop: 0 }}>Procesando...</h3>
                <p style={{ fontWeight: 'bold' }}>{statusMessage}</p>
                <div style={{ margin: '1rem auto', width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid var(--primary-color)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              </>
            )}
            {backupStatus === 'success' && (
              <>
                <h3 style={{ marginTop: 0, color: '#2ecc71' }}>Éxito</h3>
                <p style={{ fontWeight: 'bold' }}>{statusMessage}</p>
                <button onClick={() => setBackupStatus('idle')} style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '1rem' }}>Entendido</button>
              </>
            )}
            {backupStatus === 'error' && (
              <>
                <h3 style={{ marginTop: 0, color: '#e74c3c' }}>Error</h3>
                <p style={{ fontWeight: 'bold', color: '#ff6b6b' }}>{statusMessage}</p>
                <button onClick={() => setBackupStatus('idle')} style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', marginTop: '1rem' }}>Cerrar</button>
              </>
            )}
          </div>
        </div>
      )}

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
          <Route path="/usuarios" element={<ProtectedRoute><Layout><UserManagement /></Layout></ProtectedRoute>} />
          
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AdminProvider>
  );
}
