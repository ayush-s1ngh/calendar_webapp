/**
 * Axios API client
 * - Injects Authorization header from localStorage (browser only)
 * - Uses a single instance with baseURL from NEXT_PUBLIC_API_BASE_URL
 * - On 401 responses, logs out and hard-redirects to /login
 *
 * Notes:
 * - Request interceptor uses AxiosHeaders.from(...) to normalize headers,
 *   avoiding type juggling between AxiosHeaders and RawAxiosRequestHeaders.
 */
import axios, { AxiosHeaders } from "axios"
import { authStore } from "@/store/auth"

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  withCredentials: false,
})

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token")
    if (token) {
      const headers = AxiosHeaders.from(config.headers ?? {})
      headers.set("Authorization", `Bearer ${token}`)
      config.headers = headers
    }
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401 && typeof window !== "undefined") {
      try {
        authStore.getState().logout()
      } finally {
        if (window.location.pathname !== "/login") {
          window.location.href = "/login"
        }
      }
    }
    return Promise.reject(error)
  }
)

export default api