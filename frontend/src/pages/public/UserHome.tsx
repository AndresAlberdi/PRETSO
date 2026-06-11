import Dashboard from '../../components/Dashboard'

export default function UserHome() {
  return (
    <main style={{ maxWidth: 1000, margin: '2rem auto', padding: '0 1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2rem', gap: '2rem', flexWrap: 'wrap' }}>
        <img src="/assets/logo_this.jpg" alt="Logo THIS" style={{ width: '120px', objectFit: 'contain' }} />
        <div style={{ flex: 1, textAlign: 'center', minWidth: '280px' }}>
          <h1 style={{ whiteSpace: 'pre-line', margin: '0 0 1rem 0' }}>
            {"PRETSO\nPrecios del Teatro del Siglo de Oro"}
          </h1>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 500, margin: '0 0 0.5rem 0' }}>
            Base de datos para el estudio de las dinámicas económicas del teatro comercial en los territorios hispanos (siglos XVI-XVII)
          </h2>
          <h3 style={{ fontSize: '1rem', fontWeight: 400, margin: 0 }}>
            Project: [101150056] — [THIS] — [HORIZON-MSCA-2023-PF-01]
          </h3>
        </div>
        <img src="/assets/logo_ue.png" alt="Logo UE" style={{ width: '120px', objectFit: 'contain' }} />
      </div>
      <p style={{ textAlign: 'center', opacity: 0.8, marginBottom: '2rem' }}>Bienvenido a tu panel principal. A continuación puedes explorar las estadísticas de la plataforma.</p>
      <Dashboard />
    </main>
  )
}
