import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'

function storageKey(uid: string) {
  return `pretso_favorites_${uid}`
}

function loadFavorites(uid: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(uid))
    return raw ? (JSON.parse(raw) as string[]) : []
  } catch {
    return []
  }
}

export function useFavorites() {
  const { user } = useAuth()
  const uid = user?.uid ?? ''

  const [favorites, setFavorites] = useState<string[]>(() =>
    uid ? loadFavorites(uid) : []
  )

  useEffect(() => {
    setFavorites(uid ? loadFavorites(uid) : [])
  }, [uid])

  const persist = useCallback(
    (next: string[]) => {
      if (!uid) return
      localStorage.setItem(storageKey(uid), JSON.stringify(next))
      setFavorites(next)
    },
    [uid]
  )

  const addFavorite = useCallback(
    (recordId: string) => {
      setFavorites((prev) => {
        if (prev.includes(recordId)) return prev
        const next = [...prev, recordId]
        if (uid) localStorage.setItem(storageKey(uid), JSON.stringify(next))
        return next
      })
    },
    [uid]
  )

  const removeFavorite = useCallback(
    (recordId: string) => {
      setFavorites((prev) => {
        const next = prev.filter((id) => id !== recordId)
        if (uid) localStorage.setItem(storageKey(uid), JSON.stringify(next))
        return next
      })
    },
    [uid]
  )

  const isFavorite = useCallback(
    (recordId: string): boolean => favorites.includes(recordId),
    [favorites]
  )

  return { favorites, addFavorite, removeFavorite, isFavorite, persist }
}
