import { useTranslation } from 'react-i18next'
import { useLaunchStatus } from '../hooks/useLaunchStatus'

const DEFAULT_THRESHOLD = 10

export default function LaunchProgress() {
  const { t } = useTranslation()
  const { data, loading } = useLaunchStatus()

  // Mientras carga o si el backend no responde, mostramos valores por defecto
  const published_count = data?.published_count ?? 0
  const threshold = data?.threshold ?? DEFAULT_THRESHOLD
  const portal_active = data?.portal_active ?? false

  if (loading) return <p>…</p>

  if (portal_active) {
    return (
      <div style={{ margin: '1.5rem 0', padding: '1rem', background: 'rgba(80, 200, 120, 0.06)', border: '1px solid rgba(80, 200, 120, 0.25)', borderRadius: '8px' }}>
        <p style={{ margin: 0, color: '#50c878', fontWeight: 600, fontSize: '1.05rem' }}>
          ✓ El portal está activo — {published_count} registros publicados
        </p>
      </div>
    )
  }

  return (
    <div style={{ margin: '1rem 0' }}>
      <progress value={published_count} max={threshold} style={{ width: '100%' }} />
      <p>
        {t('launch.progress', { count: published_count, threshold })}
      </p>
    </div>
  )
}
