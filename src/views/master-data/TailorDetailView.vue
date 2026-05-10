<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { Card, Badge, Table } from 'ui-assets'

const route = useRoute()
const router = useRouter()
const { request } = useApi()

const loading = ref(true)
const tailor = ref(null)
const summary = ref(null)
const distributions = ref([])

const columns = [
  { key: 'name', label: 'Distribution' },
  { key: 'pre_order', label: 'Pre-Order' },
  { key: 'brand', label: 'Brand' },
  { key: 'article', label: 'Article' },
  { key: 'size', label: 'Size' },
  { key: 'total_cutting', label: 'Distributed' },
  { key: 'deposit_remaining', label: 'Remaining' },
  { key: 'total_price', label: 'Total Price' },
  { key: 'status', label: 'Status' },
]

onMounted(async () => {
  try {
    const res = await request(`/tailors/${route.params.id}/detail-stats`)
    tailor.value = res.tailor
    summary.value = res.summary
    distributions.value = res.distributions
  } catch {
    router.push({ name: 'tailors' })
  } finally {
    loading.value = false
  }
})

const statusBadge = (status) => {
  if (status === 'done') return 'success'
  if (status === 'overdue') return 'danger'
  return 'warning'
}

const statusLabel = (status) => {
  if (status === 'done') return 'Done'
  if (status === 'overdue') return 'Overdue'
  return 'In Progress'
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
      <button @click="router.back()" class="p-2 rounded-lg text-surface-500 hover:bg-surface-100 transition-colors cursor-pointer" title="Back">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      </button>
      <div>
        <h1 class="text-2xl font-bold text-surface-900">{{ tailor?.name || 'Tailor Detail' }}</h1>
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
          <p class="text-xs text-surface-500 mt-1">Total Distributed</p>
        </Card>
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900">{{ summary.total_deposited }}</p>
          <p class="text-xs text-surface-500 mt-1">Total Deposited</p>
        </Card>
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900" :class="summary.total_remaining > 0 ? 'text-amber-600' : 'text-green-600'">{{ summary.total_remaining }}</p>
          <p class="text-xs text-surface-500 mt-1">Remaining</p>
        </Card>
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900">{{ formatCurrency(summary.total_price) }}</p>
          <p class="text-xs text-surface-500 mt-1">Total Price</p>
        </Card>
      </div>

      <div class="grid grid-cols-3 gap-4 mb-6">
        <Card variant="bordered" class="text-center py-3">
          <p class="text-xl font-semibold text-green-600">{{ summary.done_count }}</p>
          <p class="text-xs text-surface-500 mt-0.5">Done</p>
        </Card>
        <Card variant="bordered" class="text-center py-3">
          <p class="text-xl font-semibold text-amber-600">{{ summary.in_progress_count }}</p>
          <p class="text-xs text-surface-500 mt-0.5">In Progress</p>
        </Card>
        <Card variant="bordered" class="text-center py-3">
          <p class="text-xl font-semibold text-red-600">{{ summary.overdue_count }}</p>
          <p class="text-xs text-surface-500 mt-0.5">Overdue</p>
        </Card>
      </div>

      <Card variant="bordered">
        <div class="px-4 py-3 border-b border-surface-200">
          <h2 class="text-lg font-semibold text-surface-900">Distributions</h2>
        </div>
        <div v-if="distributions.length === 0" class="text-center py-12">
          <p class="text-surface-500">No distributions found</p>
        </div>
        <Table v-else :columns="columns" :rows="distributions" :per-page="15" expandable>
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
              <table class="w-full text-sm">
                <thead>
                  <tr class="border-b border-surface-200">
                    <th class="py-1.5 px-3 text-left font-medium text-surface-500">Deposit</th>
                    <th class="py-1.5 px-3 text-right font-medium text-surface-500">Sewing Result</th>
                    <th class="py-1.5 px-3 text-right font-medium text-surface-500">Price/Pcs</th>
                    <th class="py-1.5 px-3 text-right font-medium text-surface-500">Total Price</th>
                    <th class="py-1.5 px-3 text-left font-medium text-surface-500">Date</th>
                    <th class="py-1.5 px-3 text-left font-medium text-surface-500">Status</th>
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
            </div>
            <p v-else class="px-3 py-2 text-sm text-surface-400">No deposits yet</p>
          </template>
        </Table>
      </Card>
    </template>
  </div>
</template>