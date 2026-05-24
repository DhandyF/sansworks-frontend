<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useApi } from '@/composables/useApi'
import { useDebounce } from '@/composables/useDebounce'
import { Card, Badge, Table } from 'ui-assets'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { request } = useApi()
const { debounce } = useDebounce(500)

const loading = ref(true)
const tailor = ref(null)
const summary = ref(null)
const brands = ref([])
const distributions = ref([])
const pagination = ref({ currentPage: 1, perPage: 15, total: 0, lastPage: 1, from: 0, to: 0 })

const searchQuery = ref('')
const brandFilter = ref('')
const statusFilter = ref('')

const statusFilters = computed(() => [
  { value: '', label: t('tailorDetail.filterAll') },
  { value: 'done', label: t('common.done') },
  { value: 'in_progress', label: t('common.inProgress') },
  { value: 'overdue', label: t('common.overdue') },
])

function filterBadgeVariant(filter) {
  if (filter === statusFilter.value) {
    if (filter === '') return 'primary'
    return statusBadge(filter)
  }
  return 'default'
}

const columns = computed(() => [
  { key: 'name', label: t('tailorDetail.distribution') },
  { key: 'pre_order', label: t('tailorDetail.preOrder') },
  { key: 'brand', label: t('common.brand') },
  { key: 'article', label: t('tailorDetail.article') },
  { key: 'size', label: t('tailorDetail.size') },
  { key: 'total_cutting', label: t('tailorDetail.distributed') },
  { key: 'deposit_remaining', label: t('common.remaining') },
  { key: 'total_price', label: t('tailorDetail.totalPrice') },
  { key: 'status', label: t('common.status') },
])

function buildParams(page) {
  const params = new URLSearchParams()
  if (searchQuery.value) params.set('search', searchQuery.value)
  if (brandFilter.value) params.set('brand_filter', brandFilter.value)
  if (statusFilter.value) params.set('status_filter', statusFilter.value)
  params.set('page', String(page || pagination.value.currentPage))
  params.set('per_page', '15')
  return params.toString()
}

async function fetchData(page) {
  try {
    const res = await request(`/tailors/${route.params.id}/detail-stats?${buildParams(page)}`)
    tailor.value = res.tailor
    summary.value = res.summary
    brands.value = res.brands || []
    distributions.value = res.distributions.data
    const d = res.distributions
    const from = d.total > 0 ? (d.current_page - 1) * d.per_page + 1 : 0
    const to = Math.min(d.current_page * d.per_page, d.total)
    pagination.value = {
      currentPage: d.current_page,
      perPage: d.per_page,
      total: d.total,
      lastPage: d.last_page,
      from,
      to,
    }
  } catch {
    router.push({ name: 'tailors' })
  } finally {
    loading.value = false
  }
}

watch(searchQuery, () => debounce(() => fetchData(1)))
watch(brandFilter, () => fetchData(1))
watch(statusFilter, () => fetchData(1))

onMounted(() => fetchData(1))

const statusBadge = (status) => {
  if (status === 'done') return 'success'
  if (status === 'overdue') return 'danger'
  return 'warning'
}

const statusLabel = (status) => {
  if (status === 'done') return t('common.done')
  if (status === 'overdue') return t('common.overdue')
  return t('common.inProgress')
}

function formatDate(date) {
  return date ? new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <button @click="router.back()" class="p-2 rounded-lg text-surface-500 hover:bg-surface-100 transition-colors cursor-pointer" :title="t('common.back')">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      </button>
      <div>
        <h1 class="text-2xl font-bold text-surface-900">{{ tailor?.name || t('tailorDetail.title') }}</h1>
        <p v-if="tailor" class="mt-0.5 text-sm text-surface-500">
          <span v-if="tailor.phone">{{ tailor.phone }}</span>
          <span v-if="tailor.phone && tailor.address" class="mx-1">&middot;</span>
          <span v-if="tailor.address">{{ tailor.address }}</span>
        </p>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>

    <template v-else-if="tailor">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900">{{ summary.total_distributed }}</p>
          <p class="text-xs text-surface-500 mt-1">{{ t('tailorDetail.totalDistributed') }}</p>
        </Card>
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900">{{ summary.total_deposited }}</p>
          <p class="text-xs text-surface-500 mt-1">{{ t('tailorDetail.totalDeposited') }}</p>
        </Card>
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900" :class="summary.total_remaining > 0 ? 'text-amber-600' : 'text-green-600'">{{ summary.total_remaining }}</p>
          <p class="text-xs text-surface-500 mt-1">{{ t('common.remaining') }}</p>
        </Card>
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900">{{ formatCurrency(summary.total_price) }}</p>
          <p class="text-xs text-surface-500 mt-1">{{ t('tailorDetail.totalPrice') }}</p>
        </Card>
      </div>

      <div class="grid grid-cols-3 gap-4 mb-6">
        <Card variant="bordered" class="text-center py-3">
          <p class="text-xl font-semibold text-green-600">{{ summary.done_count }}</p>
          <p class="text-xs text-surface-500 mt-0.5">{{ t('common.done') }}</p>
        </Card>
        <Card variant="bordered" class="text-center py-3">
          <p class="text-xl font-semibold text-amber-600">{{ summary.in_progress_count }}</p>
          <p class="text-xs text-surface-500 mt-0.5">{{ t('common.inProgress') }}</p>
        </Card>
        <Card variant="bordered" class="text-center py-3">
          <p class="text-xl font-semibold text-red-600">{{ summary.overdue_count }}</p>
          <p class="text-xs text-surface-500 mt-0.5">{{ t('common.overdue') }}</p>
        </Card>
      </div>

      <Card variant="bordered">
        <div class="px-4 py-3 border-b border-surface-200">
          <h2 class="text-lg font-semibold text-surface-900">{{ t('tailorDetail.distributions') }}</h2>
        </div>
        <div class="px-4 py-3 flex flex-col sm:flex-row items-start sm:items-center gap-3 border-b border-surface-200">
          <div class="w-48">
            <input v-model="searchQuery" type="text" :placeholder="t('tailorDetail.searchPlaceholder')" class="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500" />
          </div>
          <div class="w-48">
            <select v-model="brandFilter" class="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500">
              <option value="">{{ t('common.allBrands') }}</option>
              <option v-for="b in brands" :key="b.id" :value="b.id">{{ b.name }}</option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <button v-for="f in statusFilters" :key="f.value" @click="statusFilter = f.value" class="cursor-pointer">
              <Badge :variant="filterBadgeVariant(f.value)" size="sm">{{ f.label }}</Badge>
            </button>
          </div>
        </div>
        <div v-if="distributions.length === 0" class="text-center py-12">
          <p class="text-surface-500">{{ t('tailorDetail.noFilters') }}</p>
        </div>
        <Table v-else :columns="columns" :rows="distributions" :pagination="pagination" @page-change="fetchData" expandable showVerticalBorder>
          <template #name="{ value }"><span class="whitespace-nowrap min-w-[160px] inline-block font-medium text-surface-800">{{ value }}</span></template>
          <template #pre_order="{ value }"><span class="whitespace-nowrap">{{ value?.name || '-' }}</span></template>
          <template #brand="{ value }"><Badge variant="primary" size="sm">{{ value?.name || '-' }}</Badge></template>
          <template #article="{ value }"><span class="whitespace-nowrap">{{ value?.name || '-' }}</span></template>
          <template #size="{ value }"><Badge variant="default" size="sm">{{ value?.abbreviation || '-' }}</Badge></template>
          <template #total_cutting="{ value }"><span class="block text-right font-medium">{{ value }}</span></template>
          <template #deposit_remaining="{ value }"><span class="block text-right"><Badge :variant="value > 0 ? 'warning' : 'success'" size="sm">{{ value }}</Badge></span></template>
          <template #total_price="{ value }"><span class="block text-right font-medium whitespace-nowrap">{{ formatCurrency(value) }}</span></template>
          <template #status="{ value }"><Badge :variant="statusBadge(value)" size="sm">{{ statusLabel(value) }}</Badge></template>
          <template #expanded="{ row }">
            <div v-if="row.deposits && row.deposits.length > 0" class="py-2">
              <Card variant="bordered" class="shadow-none!">
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-surface-200">
                      <th class="py-1.5 px-3 text-left font-medium text-surface-500">{{ t('tailorDetail.deposit') }}</th>
                      <th class="py-1.5 px-3 text-right font-medium text-surface-500">{{ t('tailorDetail.sewingResult') }}</th>
                      <th class="py-1.5 px-3 text-right font-medium text-surface-500">{{ t('tailorDetail.pricePerPcs') }}</th>
                      <th class="py-1.5 px-3 text-right font-medium text-surface-500">{{ t('tailorDetail.totalPrice') }}</th>
                      <th class="py-1.5 px-3 text-left font-medium text-surface-500">{{ t('tailorDetail.depositDate') }}</th>
                      <th class="py-1.5 px-3 text-left font-medium text-surface-500">{{ t('common.status') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="dep in row.deposits" :key="dep.id" class="border-b border-surface-100 last:border-0">
                      <td class="py-1.5 px-3 whitespace-nowrap">{{ dep.name }}</td>
                      <td class="py-1.5 px-3 text-right">{{ dep.total_sewing_result }}</td>
                      <td class="py-1.5 px-3 text-right">{{ formatCurrency(dep.cutting_price_per_pcs) }}</td>
                      <td class="py-1.5 px-3 text-right font-medium">{{ formatCurrency(dep.total_price) }}</td>
                      <td class="py-1.5 px-3">{{ formatDate(dep.deposit_date) }}</td>
                      <td class="py-1.5 px-3"><Badge :variant="statusBadge(dep.status)" size="sm">{{ statusLabel(dep.status) }}</Badge></td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            </div>
            <p v-else class="px-3 py-2 text-sm text-surface-400">{{ t('tailorDetail.noDeposits') }}</p>
          </template>
        </Table>
      </Card>
    </template>
  </div>
</template>