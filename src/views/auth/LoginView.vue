<script setup>
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button, Input } from 'ui-assets'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const username = ref('')
const password = ref('')
const loading = ref(false)
const error = ref('')

async function handleLogin() {
  error.value = ''
  if (!username.value || !password.value) {
    error.value = 'Please fill in all fields'
    return
  }

  loading.value = true
  const result = await auth.login(username.value, password.value)
  loading.value = false

  if (result.success) {
    const redirect = route.query.redirect || { name: 'users' }
    router.push(redirect)
  } else {
    error.value = result.error
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
    <div class="w-full max-w-md">
      <div class="text-center">
        <div class="mx-auto w-16 h-16 bg-primary-600 rounded-xl flex items-center justify-center shadow-lg">
          <svg class="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h2 class="mt-6 text-3xl font-bold text-surface-900">Sign in to SansWorks</h2>
        <p class="mt-2 text-sm text-surface-500">Production management system</p>
      </div>

      <form class="mt-8 space-y-6 bg-white p-8 rounded-2xl shadow-xl" @submit.prevent="handleLogin">
        <div v-if="error" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {{ error }}
        </div>

        <div class="space-y-4">
          <Input
            v-model="username"
            label="Username"
            placeholder="Enter your username"
            :disabled="loading"
          />
          <Input
            v-model="password"
            type="password"
            label="Password"
            placeholder="Enter your password"
            :disabled="loading"
          />
        </div>

        <Button type="submit" :loading="loading" block size="lg">
          Sign In
        </Button>
      </form>
    </div>
  </div>
</template>