import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'


export default function Register() {
  const { t } = useTranslation()
  const { register } = useAuth()

  const [name, setName] = useState('')
  const [institution, setInstitution] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      await register(email, password, name, institution)
      setSubmitted(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.generic'))
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <main style={{ maxWidth: 400, margin: '4rem auto', padding: '0 1rem' }}>
        <p>{t('auth.verify_email')}</p>
      </main>
    )
  }

  return (
    <main style={{ maxWidth: 400, margin: '4rem auto', padding: '0 1rem' }}>
      <h1>{t('auth.register')}</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <label>
          {t('auth.name')}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
          />
        </label>
        <label>
          {t('auth.institution')}
          <input
            type="text"
            value={institution}
            onChange={(e) => setInstitution(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
          />
        </label>
        <label>
          {t('auth.email')}
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
          />
        </label>
        <label>
          {t('auth.password')}
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: '0.5rem', marginTop: '0.25rem' }}
          />
        </label>
        {error && <p style={{ color: 'red', margin: 0 }}>{error}</p>}
        <button type="submit" disabled={submitting} style={{ padding: '0.6rem' }}>
          {submitting ? '…' : t('auth.register')}
        </button>
      </form>
    </main>
  )
}
