<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button } from 'ui-assets'

const router = useRouter()
const auth = useAuthStore()

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen bg-surface-50">
    <div class="bg-white border-b border-surface-200 shadow-sm">
      <div class="px-4 sm:px-6 lg:px-8">
        <div class="flex h-14 items-center justify-between">
          <div class="flex items-center gap-4">
            <img src="/assets/sansworks_logo_2.jpeg" alt="sansworks" class="h-10">
            <span class="text-lg font-bold text-surface-900">Sansworks</span>
          </div>
          <div class="flex items-center gap-3">
            <span class="text-sm text-surface-600">{{ auth.user?.name }}</span>
            <Button variant="outline" size="sm" @click="handleLogout">
              Sign Out
            </Button>
          </div>
        </div>
      </div>
    </div>
    <main class="p-4 sm:p-6 lg:p-8">
      <router-view />
    </main>
  </div>
</template>
