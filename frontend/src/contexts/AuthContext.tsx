import { createContext, useCallback, useEffect, useRef, useState } from 'react'
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendEmailVerification,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth } from '../firebase'
import { api } from '../api/client'

export interface AuthUser {
  uid: string
  email: string
  role?: string
  emailVerified: boolean
}

export interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  register: (email: string, password: string, name: string, institution: string) => Promise<void>
  getToken: () => Promise<string | null>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

const SESSION_TIMEOUT_MS = 60 * 60 * 1000 // 60 minutos

/** Extrae el rol del custom claim del token de Firebase. */
async function getRoleFromToken(firebaseUser: FirebaseUser): Promise<string | undefined> {
  const idTokenResult = await firebaseUser.getIdTokenResult()
  return idTokenResult.claims['role'] as string | undefined
}

/** Convierte un FirebaseUser en nuestro AuthUser. */
async function toAuthUser(firebaseUser: FirebaseUser): Promise<AuthUser> {
  const role = await getRoleFromToken(firebaseUser)
  return {
    uid: firebaseUser.uid,
    email: firebaseUser.email ?? '',
    role,
    emailVerified: firebaseUser.emailVerified,
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true) // true hasta que Firebase resuelva el estado inicial
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearSessionTimer = useCallback(() => {
    if (timeoutRef.current !== null) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const logout = useCallback(async () => {
    clearSessionTimer()
    await signOut(auth)
    setUser(null)
  }, [clearSessionTimer])

  const startSessionTimer = useCallback(() => {
    clearSessionTimer()
    timeoutRef.current = setTimeout(() => {
      logout()
    }, SESSION_TIMEOUT_MS)
  }, [clearSessionTimer, logout])

  // Escucha cambios de sesión de Firebase (persiste entre recargas de página)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const authUser = await toAuthUser(firebaseUser)
        setUser(authUser)
        startSessionTimer()
      } else {
        setUser(null)
        clearSessionTimer()
      }
      setLoading(false)
    })
    return () => {
      unsubscribe()
      clearSessionTimer()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true)
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password)
      const authUser = await toAuthUser(credential.user)
      setUser(authUser)
      startSessionTimer()
    } finally {
      setLoading(false)
    }
  }, [startSessionTimer])

  const register = useCallback(
    async (email: string, password: string, name: string, institution: string) => {
      setLoading(true)
      try {
        const credential = await createUserWithEmailAndPassword(auth, email, password)
        // Enviar correo de verificación
        await sendEmailVerification(credential.user)
        
        // Crear perfil del usuario en Firestore
        const token = await credential.user.getIdToken()
        await api.post('/users/profile', { name, institution }, {
          headers: { Authorization: `Bearer ${token}` }
        })

        const authUser = await toAuthUser(credential.user)
        setUser(authUser)
        startSessionTimer()
      } finally {
        setLoading(false)
      }
    },
    [startSessionTimer]
  )

  /** Devuelve el JWT de Firebase para enviarlo al backend en el header Authorization. */
  const getToken = useCallback(async (): Promise<string | null> => {
    const firebaseUser = auth.currentUser
    if (!firebaseUser) return null
    return firebaseUser.getIdToken()
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, register, getToken }}>
      {children}
    </AuthContext.Provider>
  )
}
