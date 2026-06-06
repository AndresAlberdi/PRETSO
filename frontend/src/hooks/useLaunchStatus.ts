import { useEffect, useState } from 'react'
import { api } from '../api/client'
import type { LaunchStatus } from '../api/types'

export function useLaunchStatus() {
  const [data, setData] = useState<LaunchStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<LaunchStatus>('/launch-status')
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

  return { data, loading }
}
