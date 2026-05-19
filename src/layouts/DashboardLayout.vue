<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useAuthStore } from '@/stores/auth'
import { Button, Dropdown, DropdownItem } from 'ui-assets'

const router = useRouter()
const auth = useAuthStore()
const { t, locale } = useI18n()
const mobileMenuOpen = ref(false)

const menuGroups = [
  {
    label: () => t('nav.management'),
    items: [
      { name: () => t('nav.brands'), route: 'brands' },
      { name: () => t('nav.articles'), route: 'articles' },
      { name: () => t('nav.users'), route: 'users' },
      { name: () => t('nav.tailors'), route: 'tailors' },
      { name: () => t('nav.sizes'), route: 'sizes' },
    ],
  },
]

const directLinks = [
  { name: () => t('nav.preOrders'), route: 'pre-orders' },
  { name: () => t('nav.shipments'), route: 'shipments' },
  { name: () => t('nav.production'), route: 'production' },
  { name: () => t('nav.payslips'), route: 'payslips' },
]

function navigate(routeName) {
  router.push({ name: routeName })
  mobileMenuOpen.value = false
}

async function handleLogout() {
  await auth.logout()
  router.push({ name: 'login' })
}

function setLocale(lang) {
  locale.value = lang
  localStorage.setItem('locale', lang)
}
</script>

<template>
  <div class="min-h-screen bg-surface-50">
    <nav class="bg-white border-b border-surface-200 shadow-sm">
      <div class="px-4 sm:px-6 lg:px-8">
        <div class="flex h-14 items-center justify-between">
          <div class="flex items-center gap-4">
            <router-link :to="{ name: 'users' }" class="flex items-center">
              <img src="/assets/sansworks_logo_2.jpeg" alt="sansworks" class="h-10">
              <span class="text-lg font-bold text-surface-900">Sansworks</span>
            </router-link>

            <div class="hidden md:flex items-center">
              <button
                v-for="link in directLinks"
                :key="link.route"
                @click="navigate(link.route)"
                class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors text-surface-600 hover:bg-surface-100 hover:text-surface-900 cursor-pointer"
              >
                {{ link.name() }}
              </button>
              <Dropdown
                v-for="group in menuGroups"
                :key="group.label"
                placement="bottom-start"
              >
                <template #trigger>
                  <button class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-colors text-surface-600 hover:bg-surface-100 hover:text-surface-900 cursor-pointer">
                    {{ group.label() }}
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                  </button>
                </template>
                <DropdownItem
                  v-for="item in group.items"
                  :key="item.route"
                  @click="(close) => { close(); navigate(item.route) }"
                >
                  {{ item.name() }}
                </DropdownItem>
              </Dropdown>
            </div>
          </div>

          <div class="flex items-center gap-3">
            <Dropdown placement="bottom-end">
              <template #trigger>
                <button class="inline-flex items-center gap-1 px-2 py-1 text-sm rounded-lg text-surface-600 hover:bg-surface-100 cursor-pointer">
                  {{ locale === 'en' ? 'EN' : 'ID' }}
                  <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
                </button>
              </template>
              <DropdownItem @click="setLocale('en')">
                <span :class="{ 'font-bold': locale === 'en' }">English</span>
              </DropdownItem>
              <DropdownItem @click="setLocale('id')">
                <span :class="{ 'font-bold': locale === 'id' }">Bahasa Indonesia</span>
              </DropdownItem>
            </Dropdown>

            <span class="text-sm text-surface-500 hidden sm:block">{{ auth.user?.username || 'User' }}</span>
            <div class="hidden md:block">
              <Button class="text-red-600!" variant="ghost" size="sm" @click="handleLogout">{{ t('nav.signOut') }}</Button>
            </div>
            <button
              class="md:hidden p-2 rounded-lg text-surface-600 hover:bg-surface-100 transition-colors cursor-pointer"
              @click="mobileMenuOpen = !mobileMenuOpen"
            >
              <svg v-if="!mobileMenuOpen" class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <svg v-else class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <Teleport to="body">
        <Transition name="mobile-menu">
          <div v-if="mobileMenuOpen" class="fixed inset-x-0 top-14 z-50 md:hidden" @click="mobileMenuOpen = false">
            <div class="mx-3 mt-2 bg-white border border-surface-200 rounded-xl shadow-lg overflow-hidden" @click.stop>
              <div class="py-2">
                <button
                  v-for="link in directLinks"
                  :key="link.route"
                  @click="navigate(link.route)"
                  class="block w-full text-left px-4 py-2.5 text-sm font-medium rounded-lg mx-2 text-surface-700 hover:bg-primary-50 hover:text-primary-700 transition-colors cursor-pointer"
                >
                  {{ link.name() }}
                </button>
                <template v-for="group in menuGroups" :key="group.label">
                  <div class="px-4 pt-3 pb-1 text-xs font-semibold text-surface-400 uppercase tracking-wider">{{ group.label() }}</div>
                  <button
                    v-for="item in group.items"
                    :key="item.route"
                    @click="navigate(item.route)"
                    class="block w-full text-left px-4 py-2.5 text-sm font-medium rounded-lg mx-2 text-surface-600 hover:bg-primary-50 hover:text-primary-700 transition-colors cursor-pointer pl-8"
                  >
                    {{ item.name() }}
                  </button>
                </template>
                <div class="px-3 py-2 border-t border-surface-200 mt-2">
                  <div class="flex gap-2">
                    <button @click="setLocale('en')" :class="locale === 'en' ? 'font-bold text-primary-600' : 'text-surface-600'" class="px-3 py-1.5 text-sm rounded-lg hover:bg-surface-100 cursor-pointer">EN</button>
                    <button @click="setLocale('id')" :class="locale === 'id' ? 'font-bold text-primary-600' : 'text-surface-600'" class="px-3 py-1.5 text-sm rounded-lg hover:bg-surface-100 cursor-pointer">ID</button>
                  </div>
                </div>
                <div class="border-t border-surface-200 pt-2 mr-2">
                  <button @click="mobileMenuOpen = false; handleLogout()" class="block w-full text-left px-4 py-2.5 text-sm font-medium rounded-lg mx-2 text-red-600 hover:bg-red-50 transition-colors cursor-pointer">
                    {{ t('nav.signOut') }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>
    </nav>

    <main class="p-4 sm:p-6 lg:p-8">
      <router-view />
    </main>
  </div>
</template>

<style>
.mobile-menu-enter-active { transition: all 0.2s ease-out; }
.mobile-menu-leave-active { transition: all 0.15s ease-in; }
.mobile-menu-enter-from, .mobile-menu-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
