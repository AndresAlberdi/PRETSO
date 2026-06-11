import axios from 'axios'
import { auth } from '../firebase'

// En producción usa la URL directa del backend para evitar problemas con rewrites
// En desarrollo usa el proxy de Vite (/api/v1)
const BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'

export const api = axios.create({ baseURL: BASE_URL })

api.interceptors.request.use(async (config) => {
  // Disable caching for all API requests (fixes Firebase Hosting CDN / browser GET caching)
  config.params = config.params || {}
  config.params._t = new Date().getTime()

  const currentUser = auth.currentUser
  if (currentUser) {
    const token = await currentUser.getIdToken()
    if (token) {
      config.headers = config.headers || {}
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// Si el portal está inactivo (503 PORTAL_INACTIVE), devolver null en lugar de lanzar error
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error.response?.status === 503 &&
      error.response?.data?.error?.code === 'PORTAL_INACTIVE'
    ) {
      return Promise.resolve({ data: null })
    }
    return Promise.reject(error)
  }
)
