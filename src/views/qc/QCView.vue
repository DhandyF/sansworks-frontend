<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useApi } from '@/composables/useApi'
import { useDebounce } from '@/composables/useDebounce'
import { usePersistentFilters } from '@/composables/usePersistentFilters'
import { Input, SearchableDropdown } from 'ui-assets'
import RepairTab from '@/components/qc/RepairTab.vue'
import RepairDepositTab from '@/components/qc/RepairDepositTab.vue'

const route = useRoute()
const router = useRouter()
const { request } = useApi()
const { t } = useI18n()

const activeTab = ref(route.query.tab || 'repair')
const { search, tailorFilter } = usePersistentFilters('qc-filters', {
  search: '',
  tailorFilter: ''
})
const { debounce } = useDebounce(500)

const tabs = [
  { id: 'repair', name: computed(() => t('repairs.title')), component: RepairTab },
  { id: 'deposit', name: computed(() => t('repairDeposits.title')), component: RepairDepositTab },
]

const repairRef = ref(null)
const depositRef = ref(null)

const filterTailors = ref([])
let filterTailorsLoaded = false

onMounted(async () => {
  if (!filterTailorsLoaded) {
    try {
      const res = await request('/tailors?per_page=1000000')
      filterTailors.value = res.data.map(t => ({ value: t.id, label: t.name }))
      filterTailorsLoaded = true
    } catch { /* ignore */ }
  }
  nextTick(() => {
    if (activeTab.value === 'repair') repairRef.value?.refresh()
    else depositRef.value?.refresh()
  })
})

watch(activeTab, (val) => {
  router.replace({ query: { ...route.query, tab: val } })
  nextTick(() => {
    if (val === 'repair') repairRef.value?.refresh()
    else depositRef.value?.refresh()
  })
})

watch([search, tailorFilter], () => {
  debounce(() => {
    if (activeTab.value === 'repair') repairRef.value?.refresh()
    else depositRef.value?.refresh()
  })
})
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-surface-900">{{ t('nav.qc') }}</h1>
        <p class="mt-1 text-sm text-surface-500">{{ t('repairs.description') }}</p>
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
      <div class="sm:w-48">
        <SearchableDropdown v-model="tailorFilter" :options="filterTailors" label="" :placeholder="t('repairs.selectTailor')" clearable />
      </div>
      <div class="flex-1">
        <Input v-model="search" label="" :placeholder="t('repairs.searchPlaceholder')" />
      </div>
    </div>

    <RepairTab ref="repairRef" :search="search" :tailor-filter="tailorFilter" v-if="activeTab === 'repair'" />
    <RepairDepositTab ref="depositRef" :search="search" :tailor-filter="tailorFilter" v-if="activeTab === 'deposit'" />
  </div>
</template>