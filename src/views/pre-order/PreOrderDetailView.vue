<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { Card, Badge, Table } from 'ui-assets'

const route = useRoute()
const router = useRouter()
const { request } = useApi()

const loading = ref(true)
const preOrder = ref(null)
const summary = ref(null)
const entries = ref([])

const columns = [
  { key: 'name', label: 'Pre-Order' },
  { key: 'article', label: 'Article' },
  { key: 'size', label: 'Size' },
  { key: 'total_pcs', label: 'Total Pcs' },
  { key: 'cut_qty', label: 'Cutting Done' },
  { key: 'cutting_remaining', label: 'Remaining' },
  { key: 'distributed_qty', label: 'Distributed' },
  { key: 'deposited_qty', label: 'Deposited' },
  { key: 'deadline_date', label: 'Deadline' },
  { key: 'status', label: 'Status' },
]

onMounted(async () => {
  try {
    const res = await request(`/pre-orders/${route.params.id}/detail-stats`)
    preOrder.value = res.pre_order
    summary.value = res.summary
    entries.value = res.entries
  } catch {
    router.push({ name: 'brands' })
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

const formatDate = (date) => {
  return date ? new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <button @click="router.back()" class="p-2 rounded-lg text-surface-500 hover:bg-surface-100 transition-colors cursor-pointer" title="Back">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      </button>
      <div>
        <h1 class="text-2xl font-bold text-surface-900">{{ preOrder?.name || 'Pre-Order Detail' }}</h1>
        <p class="mt-0.5 text-sm text-surface-500">
          {{ preOrder?.brand?.name || '' }}
          <span v-if="preOrder?.pre_order_date" class="ml-2">&middot; {{ formatDate(preOrder.pre_order_date) }}</span>
        </p>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>

    <template v-else-if="preOrder">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900">{{ summary.total_pcs }}</p>
          <p class="text-xs text-surface-500 mt-1">Total Pcs</p>
        </Card>
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900">{{ summary.cut_qty }}</p>
          <p class="text-xs text-surface-500 mt-1">Cutting Done</p>
        </Card>
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900">{{ summary.distributed_qty }}</p>
          <p class="text-xs text-surface-500 mt-1">Distributed</p>
        </Card>
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900">{{ summary.deposited_qty }}</p>
          <p class="text-xs text-surface-500 mt-1">Deposited</p>
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
          <h2 class="text-lg font-semibold text-surface-900">Details</h2>
        </div>
        <div v-if="entries.length === 0" class="text-center py-12">
          <p class="text-surface-500">No entries found</p>
        </div>
        <Table v-else :columns="columns" :rows="entries" :per-page="15">
          <template #name="{ value }"><span class="whitespace-nowrap min-w-[160px] inline-block font-medium text-surface-800">{{ value }}</span></template>
          <template #article="{ value }">{{ value?.name || '-' }}</template>
          <template #size="{ value }"><Badge variant="default" size="sm">{{ value?.abbreviation || '-' }}</Badge></template>
          <template #total_pcs="{ value }"><span class="block text-right">{{ value }}</span></template>
          <template #cut_qty="{ value }"><span class="block text-right">{{ value }}</span></template>
          <template #cutting_remaining="{ value }"><span class="block text-right"><Badge :variant="value > 0 ? 'success' : 'danger'" size="sm">{{ value }}</Badge></span></template>
          <template #distributed_qty="{ value }"><span class="block text-right">{{ value }}</span></template>
          <template #deposited_qty="{ value }"><span class="block text-right">{{ value }}</span></template>
          <template #deadline_date="{ value }"><span class="whitespace-nowrap">{{ formatDate(value) }}</span></template>
          <template #status="{ value }"><Badge :variant="statusBadge(value)" size="sm">{{ statusLabel(value) }}</Badge></template>
        </Table>
      </Card>
    </template>
  </div>
</template>