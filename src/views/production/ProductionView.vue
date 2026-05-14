<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useApi } from '@/composables/useApi'
import { useDebounce } from '@/composables/useDebounce'
import { Input, SearchableDropdown } from 'ui-assets'
import CuttingResultsTab from '@/components/production/CuttingResultsTab.vue'
import CuttingDistributionsTab from '@/components/production/CuttingDistributionsTab.vue'
import DepositCuttingResultsTab from '@/components/production/DepositCuttingResultsTab.vue'

const route = useRoute()
const router = useRouter()
const { request } = useApi()
const { t } = useI18n()

const activeTab = ref(route.query.tab || 'cutting')
const search = ref('')
const brandFilter = ref('')
const { debounce } = useDebounce(500)

const tabs = [
  { id: 'cutting', name: computed(() => t('production.cuttingResults')), component: CuttingResultsTab },
  { id: 'distributions', name: computed(() => t('production.distributions')), component: CuttingDistributionsTab },
  { id: 'deposits', name: computed(() => t('production.deposits')), component: DepositCuttingResultsTab },
]

const cuttingRef = ref(null)
const distRef = ref(null)
const depositRef = ref(null)

const filterBrands = ref([])
let filterBrandsLoaded = false

onMounted(async () => {
  if (!filterBrandsLoaded) {
    try {
      const res = await request('/brands?per_page=1000000')
      filterBrands.value = res.data.map(b => ({ value: b.id, label: b.name }))
      filterBrandsLoaded = true
    } catch { /* ignore */ }
  }
  nextTick(() => {
    if (activeTab.value === 'cutting') cuttingRef.value?.refresh()
    else if (activeTab.value === 'distributions') distRef.value?.refresh()
    else depositRef.value?.refresh()
  })
})

watch(activeTab, (val) => {
  router.replace({ query: { ...route.query, tab: val } })
  nextTick(() => {
    if (val === 'cutting') cuttingRef.value?.refresh()
    else if (val === 'distributions') distRef.value?.refresh()
    else depositRef.value?.refresh()
  })
})

watch([search, brandFilter], () => {
  debounce(() => {
    if (activeTab.value === 'cutting') cuttingRef.value?.refresh()
    else if (activeTab.value === 'distributions') distRef.value?.refresh()
    else depositRef.value?.refresh()
  })
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-surface-900">{{ t('production.title') }}</h1>
        <p class="mt-1 text-sm text-surface-500">{{ t('production.description') }}</p>
      </div>
    </div>

    <div class="border-b border-surface-200 mb-4">
      <nav class="flex -mb-px space-x-8">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          @click="activeTab = tab.id"
          :class="[
            activeTab === tab.id
              ? 'border-primary-500 text-primary-600'
              : 'border-transparent text-surface-500 hover:text-surface-700 hover:border-surface-300',
            'py-3 px-1 border-b-2 font-medium text-sm transition-colors cursor-pointer'
          ]"
        >{{ tab.name }}</button>
      </nav>
    </div>

    <div class="flex flex-col sm:flex-row gap-3 mb-4">
      <div class="sm:w-64">
        <SearchableDropdown v-model="brandFilter" :options="filterBrands" label="" :placeholder="t('production.searchPlaceholder')" clearable />
      </div>
      <div class="flex-1">
        <Input v-model="search" label="" :placeholder="t('production.searchPlaceholder')" />
      </div>
    </div>

    <CuttingResultsTab ref="cuttingRef" :search="search" :brand-filter="brandFilter" v-if="activeTab === 'cutting'" :key="'cutting'" />
    <CuttingDistributionsTab ref="distRef" :search="search" :brand-filter="brandFilter" v-if="activeTab === 'distributions'" :key="'dist'" />
    <DepositCuttingResultsTab ref="depositRef" :search="search" :brand-filter="brandFilter" v-if="activeTab === 'deposits'" :key="'deposit'" />
  </div>
</template>