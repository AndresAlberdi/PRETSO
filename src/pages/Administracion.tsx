import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { generateDatabaseXml, downloadXml, generateZipBlob, uploadToGoogleDrive } from '../utils/backup';
import { generateDatabaseXlsx, downloadXlsx } from '../utils/xlsxExport';

export default function Administracion() {
  const [configuringClientId, setConfiguringClientId] = useState(false);
  const [clientId, setClientId] = useState('');
  const [backupStatus, setBackupStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState('');

  useEffect(() => {
    const saved = localStorage.getItem('google_client_id');
    if (saved) setClientId(saved);
  }, []);

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
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Administración del Sistema</h1>
      
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', marginTop: '2rem' }}>
        <section style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h2>Gestión</h2>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <Link 
              to="/auditoria" 
              style={{ padding: '0.8rem 1.5rem', background: 'var(--primary-color)', color: 'white', textDecoration: 'none', borderRadius: '4px', fontWeight: 'bold' }}
            >
              Auditoría (Logs)
            </Link>
            <Link 
              to="/usuarios" 
              style={{ padding: '0.8rem 1.5rem', background: 'var(--primary-color)', color: 'white', textDecoration: 'none', borderRadius: '4px', fontWeight: 'bold' }}
            >
              Gestión de Usuarios
            </Link>
          </div>
        </section>

        <section style={{ background: 'var(--bg-card)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <h2>Exportación y Respaldos</h2>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginTop: '1rem' }}>
            <button 
              onClick={handleDownloadXml}
              style={{ padding: '0.8rem 1.5rem', background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              disabled={backupStatus === 'loading'}
            >
              Descargar Base de Datos (XML)
            </button>
            <button 
              onClick={handleDownloadXlsx}
              style={{ padding: '0.8rem 1.5rem', background: '#28a745', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              disabled={backupStatus === 'loading'}
            >
              Descargar Base de Datos (XLSX)
            </button>
            <button 
              onClick={handleGoogleDriveBackup}
              style={{ padding: '0.8rem 1.5rem', background: '#4285F4', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              disabled={backupStatus === 'loading'}
            >
              Copia a Google Drive
            </button>
          </div>

          {backupStatus !== 'idle' && (
            <div style={{ 
              marginTop: '1rem', 
              padding: '1rem', 
              borderRadius: '4px',
              background: backupStatus === 'error' ? 'rgba(255, 77, 79, 0.1)' : 
                          backupStatus === 'success' ? 'rgba(76, 175, 80, 0.1)' : 
                          'rgba(52, 152, 219, 0.1)',
              color: backupStatus === 'error' ? '#ff4d4f' : 
                     backupStatus === 'success' ? '#4caf50' : 
                     'var(--primary-color)',
              fontWeight: 'bold'
            }}>
              {statusMessage}
            </div>
          )}

          <div style={{ marginTop: '2rem' }}>
            <button 
              onClick={() => setConfiguringClientId(!configuringClientId)}
              style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer' }}
            >
              ⚙ Configurar Client ID de Google
            </button>
          </div>
        </section>
      </div>

      {configuringClientId && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '8px', maxWidth: '500px', width: '90%' }}>
            <h2>Configurar Google Client ID</h2>
            <p style={{ color: 'var(--text-secondary, #aaa)', marginBottom: '1.5rem' }}>
              Para hacer copias en Google Drive, necesita proporcionar un Client ID de Google Cloud Console
              configurado para aplicaciones web con acceso a Google Drive API.
            </p>
            <input 
              type="text" 
              placeholder="Ingrese su Client ID (ej: 123...apps.googleusercontent.com)"
              defaultValue={clientId}
              style={{ width: '100%', padding: '0.8rem', marginBottom: '1.5rem', background: 'var(--bg-body, #222)', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px' }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveClientId(e.currentTarget.value);
              }}
              autoFocus
            />
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfiguringClientId(false)} style={{ padding: '0.5rem 1rem', background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', borderRadius: '4px', cursor: 'pointer' }}>Cancelar</button>
              <button 
                onClick={(e) => {
                  const input = e.currentTarget.parentElement?.previousSibling as HTMLInputElement;
                  saveClientId(input.value);
                }} 
                style={{ padding: '0.5rem 1rem', background: 'var(--primary-color)', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
              >
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
