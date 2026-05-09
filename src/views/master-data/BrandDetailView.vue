<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { Card, Badge, Table } from 'ui-assets'

const route = useRoute()
const router = useRouter()
const { request } = useApi()

const loading = ref(true)
const brand = ref(null)
const preOrders = ref([])

const columns = [
  { key: 'name', label: 'Pre-Order', sortable: true },
  { key: 'total_pcs', label: 'Total Pcs', sortable: true },
  { key: 'cut_qty', label: 'Cutting Done', sortable: true },
  { key: 'distributed_qty', label: 'Distributed', sortable: true },
  { key: 'deposited_qty', label: 'Deposited', sortable: true },
  { key: 'pre_order_date', label: 'Order Date' },
  { key: 'deadline_date', label: 'Deadline' },
  { key: 'status', label: 'Status' },
]

onMounted(async () => {
  try {
    const res = await request(`/brands/${route.params.id}/production-stats`)
    brand.value = res.brand
    preOrders.value = res.pre_orders
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

function goToPreOrder(row) {
  router.push({ name: 'pre-order-detail', params: { id: row.id } })
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <button @click="router.push({ name: 'brands' })" class="p-2 rounded-lg text-surface-500 hover:bg-surface-100 transition-colors cursor-pointer" title="Back">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      </button>
      <div>
        <h1 class="text-2xl font-bold text-surface-900">Brand Detail</h1>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>

    <template v-else-if="brand">
      <Card variant="bordered" class="mb-6">
        <div class="px-4 py-3 border-b border-surface-200">
          <h2 class="text-lg font-semibold text-surface-900">Brand Information</h2>
        </div>
        <div class="px-4 py-3 grid-cols-1 sm:grid-cols-3 gap-4 flex w-full row">
          <div class="mr-4">
            <p class="text-xs text-surface-500">Phone</p>
            <p class="text-sm font-medium text-surface-800">{{ brand.phone || '-' }}</p>
          </div>
          <div class="mr-4">
            <p class="text-xs text-surface-500">Address</p>
            <p class="text-sm font-medium text-surface-800">{{ brand.address || '-' }}</p>
          </div>
          <div class="mr-4">
            <p class="text-xs text-surface-500">Status</p>
            <p class="text-sm font-medium text-surface-800"><Badge :variant="brand.status === 'active' ? 'success' : 'danger'" size="sm">{{ brand.status === 'active' ? 'Active' : 'Inactive' }}</Badge></p>
          </div>
        </div>
      </Card>

      <Card variant="bordered">
        <div class="px-4 py-3 border-b border-surface-200">
          <h2 class="text-lg font-semibold text-surface-900">Pre-Orders</h2>
        </div>
        <div v-if="preOrders.length === 0" class="text-center py-12">
          <p class="text-surface-500">No pre-orders found</p>
        </div>
        <Table v-else :columns="columns" :rows="preOrders" :per-page="15" clickable @row-click="goToPreOrder">
          <template #name="{ value }"><span class="whitespace-nowrap min-w-40 inline-block font-medium text-surface-800">{{ value }}</span></template>
          <template #total_pcs="{ value }"><span class="block text-right">{{ value }}</span></template>
          <template #cut_qty="{ value }"><span class="block text-right">{{ value }}</span></template>
          <template #distributed_qty="{ value }"><span class="block text-right">{{ value }}</span></template>
          <template #deposited_qty="{ value }"><span class="block text-right">{{ value }}</span></template>
          <template #pre_order_date="{ value }"><span class="whitespace-nowrap">{{ formatDate(value) }}</span></template>
          <template #deadline_date="{ value }"><span class="whitespace-nowrap">{{ formatDate(value) }}</span></template>
          <template #status="{ value }"><Badge :variant="statusBadge(value)" size="sm">{{ statusLabel(value) }}</Badge></template>
        </Table>
      </Card>
    </template>
  </div>
</template>
