import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './useAuth'

export interface HistoryEntry {
  timestamp: string
  params: object
}

const MAX_ENTRIES = 50

function storageKey(uid: string) {
  return `pretso_history_${uid}`
}

function loadHistory(uid: string): HistoryEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(uid))
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : []
  } catch {
    return []
  }
}

export function useSearchHistory() {
  const { user } = useAuth()
  const uid = user?.uid ?? ''

  const [history, setHistory] = useState<HistoryEntry[]>(() =>
    uid ? loadHistory(uid) : []
  )

  // Reload when user changes
  useEffect(() => {
    setHistory(uid ? loadHistory(uid) : [])
  }, [uid])

  const addSearch = useCallback(
    (params: object) => {
      if (!uid) return
      setHistory((prev) => {
        const entry: HistoryEntry = { timestamp: new Date().toISOString(), params }
        const next = [entry, ...prev].slice(0, MAX_ENTRIES)
        localStorage.setItem(storageKey(uid), JSON.stringify(next))
        return next
      })
    },
    [uid]
  )

  const clearHistory = useCallback(() => {
    if (!uid) return
    localStorage.removeItem(storageKey(uid))
    setHistory([])
  }, [uid])

  return { history, addSearch, clearHistory }
}
