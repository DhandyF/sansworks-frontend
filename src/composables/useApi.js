import { ref } from 'vue'
import { useAuthStore } from '@/stores/auth'

const API_BASE = import.meta.env.VITE_API_URL || 'https://sansworks-backend.test/api'

export function useApi() {
  const loading = ref(false)
  const error = ref(null)

  async function request(url, options = {}) {
    loading.value = true
    error.value = null

    const auth = useAuthStore()
    const headers = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'ngrok-skip-browser-warning': 'true',
    }

    if (auth.token) {
      headers.Authorization = `Bearer ${auth.token}`
    }

    try {
      const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: { ...headers, ...options.headers },
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.message || `Error ${response.status}`)
      }

      if (response.status === 204) return null

      return await response.json()
    } catch (err) {
      error.value = err.message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function paginate(url, page = 1, perPage = 15) {
    return request(`${url}?page=${page}&per_page=${perPage}`)
  }

  async function create(url, data) {
    return request(url, {
      method: 'POST',
      body: JSON.stringify(data),
    })
  }

  async function update(url, id, data) {
    return request(`${url}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  }

  async function remove(url, id) {
    return request(`${url}/${id}`, {
      method: 'DELETE',
    })
  }

  return { loading, error, request, paginate, create, update, remove }
}
