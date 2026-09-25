import axios from 'axios'

const isLocal =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '')

const PROD_API = 'https://followup-backend-i51c.onrender.com/api/v1'
const LOCAL_API = 'http://localhost:8000/api/v1'

const BASE_URL = import.meta.env.VITE_API_URL || (isLocal ? LOCAL_API : PROD_API)

export const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

// Attach token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('fms_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Handle 401 globally — redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('fms_token')
      localStorage.removeItem('fms_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default api
