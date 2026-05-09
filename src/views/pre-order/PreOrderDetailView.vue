<script setup>
import { ref, computed, onMounted } from 'vue'
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
const statusFilter = ref('')

const filteredEntries = computed(() => {
  if (!statusFilter.value) return entries.value
  return entries.value.filter(e => e.status === statusFilter.value)
})

const statusFilters = [
  { value: '', label: 'All' },
  { value: 'done', label: 'Done' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'overdue', label: 'Overdue' },
]

function filterBadgeVariant(filter) {
  if (filter === statusFilter.value) {
    if (filter === '') return 'primary'
    return statusBadge(filter)
  }
  return 'default'
}

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
        <template v-else>
          <div class="px-4 py-2 flex items-center gap-2 border-b border-surface-200">
            <button v-for="f in statusFilters" :key="f.value" @click="statusFilter = f.value" class="cursor-pointer">
              <Badge :variant="filterBadgeVariant(f.value)" size="sm">{{ f.label }}</Badge>
            </button>
          </div>
          <Table :columns="columns" :rows="filteredEntries" :per-page="15" expandable>
            <template #name="{ value }"><span class="whitespace-nowrap min-w-40 inline-block font-medium text-surface-800">{{ value }}</span></template>
            <template #article="{ value }">{{ value?.name || '-' }}</template>
            <template #size="{ value }"><Badge variant="default" size="sm">{{ value?.abbreviation || '-' }}</Badge></template>
            <template #total_pcs="{ value }"><span class="block text-right">{{ value }}</span></template>
            <template #cut_qty="{ value }"><span class="block text-right">{{ value }}</span></template>
            <template #cutting_remaining="{ value }"><span class="block text-right"><Badge :variant="value > 0 ? 'success' : 'danger'" size="sm">{{ value }}</Badge></span></template>
            <template #distributed_qty="{ value }"><span class="block text-right">{{ value }}</span></template>
            <template #deposited_qty="{ value }"><span class="block text-right">{{ value }}</span></template>
            <template #deadline_date="{ value }"><span class="whitespace-nowrap">{{ formatDate(value) }}</span></template>
            <template #status="{ value }"><Badge :variant="statusBadge(value)" size="sm">{{ statusLabel(value) }}</Badge></template>
            <template #expanded="{ row }">
              <div v-if="row.distributions && row.distributions.length > 0" class="space-y-3">
                <Card v-for="dist in row.distributions" :key="dist.id" variant="bordered" class="!shadow-none">
                  <div class="px-4 py-3 border-b border-surface-200 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                      <span class="text-sm font-medium text-surface-800">{{ dist.tailor?.name || '-' }}</span>
                      <Badge :variant="statusBadge(dist.status)" size="sm">{{ statusLabel(dist.status) }}</Badge>
                    </div>
                    <div class="flex items-center gap-4 text-sm">
                      <span class="text-surface-500">Distributed: <span class="text-surface-800 font-medium">{{ dist.total_cutting }}</span></span>
                      <span class="text-surface-500">Deposited: <span class="text-surface-800 font-medium">{{ dist.total_cutting - dist.deposit_remaining }}</span></span>
                      <span class="text-surface-500">Remaining: <Badge :variant="dist.deposit_remaining > 0 ? 'warning' : 'success'" size="sm">{{ dist.deposit_remaining }}</Badge></span>
                    </div>
                  </div>
                  <div class="px-4 py-2">
                    <div v-if="dist.deposits && dist.deposits.length > 0" class="space-y-1">
                      <div v-for="dep in dist.deposits" :key="dep.id" class="flex items-center gap-3 text-sm py-1">
                        <span class="text-surface-700">{{ formatDate(dep.deposit_date) }}</span>
                        <span class="text-surface-700 font-bold">{{ dep.total_sewing_result }} pcs</span>
                        <Badge :variant="statusBadge(dep.status)" size="sm">{{ statusLabel(dep.status) }}</Badge>
                      </div>
                    </div>
                    <p v-else class="text-xs text-surface-400 py-1">No deposits yet</p>
                  </div>
                </Card>
              </div>
              <div v-else class="text-sm text-surface-400">No distributions yet</div>
            </template>
          </Table>
        </template>
      </Card>
    </template>
  </div>
</template>
