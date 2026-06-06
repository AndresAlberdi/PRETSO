export default function ApiDocs() {
  return (
    <main style={{ maxWidth: 800, margin: '2rem auto', padding: '0 1rem' }}>
      <h1>API Docs</h1>
      <p>
        Especificación OpenAPI:{' '}
        <a href="/api/v1/openapi.json" target="_blank" rel="noopener noreferrer">
          /api/v1/openapi.json
        </a>
      </p>
      <p>
        Documentación interactiva (Swagger):{' '}
        <a href="/docs" target="_blank" rel="noopener noreferrer">
          /docs
        </a>
      </p>
      <iframe
        src="/docs"
        title="Swagger UI"
        style={{ width: '100%', height: '80vh', border: '1px solid #ccc', marginTop: '1rem' }}
      />
    </main>
  )
}
