import axios, { AxiosHeaders, RawAxiosRequestHeaders } from "axios"
import { authStore } from "@/store/auth"

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL,
  withCredentials: false,
})

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token")
    if (token) {
      // Ensure headers exists
      if (!config.headers) {
        config.headers = new AxiosHeaders();
        (config.headers as AxiosHeaders).set("Authorization", `Bearer ${token}`)
      }
      const headers = config.headers
      // Axios v1 may use AxiosHeaders with a .set method
      if (headers && typeof (headers as AxiosHeaders).set === "function") {
        ;(headers as AxiosHeaders).set("Authorization", `Bearer ${token}`)
      } else {
        ;(config.headers as RawAxiosRequestHeaders)["Authorization"] = `Bearer ${token}`
      }
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