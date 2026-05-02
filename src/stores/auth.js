import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

const API_BASE = import.meta.env.VITE_API_URL || 'http://sansworks-backend.test/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(localStorage.getItem('token') || '')

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  function setUser(userData) {
    user.value = userData
  }

  function setToken(newToken) {
    token.value = newToken
    localStorage.setItem('token', newToken)
  }

  async function login(username, password) {
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.message || 'Login failed' }
      }

      setToken(data.token)
      setUser(data.user.data)
      return { success: true }
    } catch {
      return { success: false, error: 'Network error. Please try again.' }
    }
  }

  async function logout() {
    try {
      await fetch(`${API_BASE}/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          Authorization: `Bearer ${token.value}`,
        },
      })
    } catch {
      // ignore errors on logout
    } finally {
      user.value = null
      token.value = ''
      localStorage.removeItem('token')
    }
  }

  async function fetchUser() {
    if (!token.value) return

    try {
      const response = await fetch(`${API_BASE}/me`, {
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${token.value}`,
        },
      })

      if (response.ok) {
        const data = await response.json()
        setUser(data.data)
      } else {
        token.value = ''
        localStorage.removeItem('token')
      }
    } catch {
      // ignore network errors
    }
  }

  function initializeFromStorage() {
    if (token.value) {
      fetchUser()
    }
  }

  return { user, token, isAuthenticated, isAdmin, login, logout, fetchUser, setUser, setToken, initializeFromStorage }
})