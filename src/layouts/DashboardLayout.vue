<script setup>
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { Button, Dropdown, DropdownItem } from 'ui-assets'

const router = useRouter()
const auth = useAuthStore()

const menuGroups = [
  {
    label: 'Management',
    items: [
      { name: 'Brands', route: 'brands' },
      { name: 'Articles', route: 'articles' },
      { name: 'Users', route: 'users' },
      { name: 'Tailors', route: 'tailors' },
      { name: 'Sizes', route: 'sizes' },
    ],
  },
]

const directLinks = [
  { name: 'Pre-Order', route: 'pre-orders' },
  { name: 'Production', route: 'production' },
]

function navigate(routeName) {
  router.push({ name: routeName })
}

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen bg-surface-50">
    <nav class="bg-white border-b border-surface-200 shadow-sm">
      <div class="px-4 sm:px-6 lg:px-8">
        <div class="flex h-14 items-center justify-between">
          <div class="flex items-center gap-4">
            <router-link :to="{ name: 'users' }" class="flex items-center gap-2">
              <div class="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span class="text-lg font-bold text-surface-900">Sansworks</span>
            </router-link>

            <div class="hidden md:flex items-center">
              <button
                v-for="link in directLinks"
                :key="link.route"
                @click="navigate(link.route)"
                class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors text-surface-600 hover:bg-surface-100 hover:text-surface-900 cursor-pointer"
              >
                {{ link.name }}
              </button>
              <Dropdown
                v-for="group in menuGroups"
                :key="group.label"
                placement="bottom-start"
              >
                <template #trigger>
                  <button class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors text-surface-600 hover:bg-surface-100 hover:text-surface-900  cursor-pointer">
                    {{ group.label }}
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </button>
                </template>
                <DropdownItem
                  v-for="item in group.items"
                  :key="item.route"
                  @click="(close) => { close(); navigate(item.route) }"
                >
                  {{ item.name }}
                </DropdownItem>
              </Dropdown>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <span class="text-sm text-surface-500 hidden sm:block">{{ auth.user?.username || 'User' }}</span>
            <Button variant="ghost" size="sm" @click="handleLogout">Sign Out</Button>
          </div>
        </div>
      </div>
    </nav>

    <main class="p-4 sm:p-6 lg:p-8">
      <router-view />
    </main>
  </div>
</template>
