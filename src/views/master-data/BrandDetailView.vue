<script setup>
import { ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useApi } from '@/composables/useApi'
import { Card, Badge } from 'ui-assets'

const route = useRoute()
const router = useRouter()
const { request } = useApi()

const loading = ref(true)
const brand = ref(null)
const summary = ref(null)
const preOrders = ref([])

onMounted(async () => {
  try {
    const res = await request(`/brands/${route.params.id}/production-stats`)
    brand.value = res.brand
    summary.value = res.summary
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
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <button @click="router.push({ name: 'brands' })" class="p-2 rounded-lg text-surface-500 hover:bg-surface-100 transition-colors cursor-pointer" title="Back">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      </button>
      <div>
        <h1 class="text-2xl font-bold text-surface-900">{{ brand?.name || 'Brand Detail' }}</h1>
        <p class="mt-0.5 text-sm text-surface-500">Production overview</p>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
      </svg>
    </div>

    <template v-else-if="brand">
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900">{{ summary.total_pcs }}</p>
          <p class="text-xs text-surface-500 mt-1">Total Pcs</p>
        </Card>
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900">{{ summary.total_cut_qty }}</p>
          <p class="text-xs text-surface-500 mt-1">Cutting Done</p>
        </Card>
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900">{{ summary.total_distributed }}</p>
          <p class="text-xs text-surface-500 mt-1">Distributed</p>
        </Card>
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900">{{ summary.total_deposited }}</p>
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
          <h2 class="text-lg font-semibold text-surface-900">Pre-Orders</h2>
        </div>
        <div v-if="preOrders.length === 0" class="text-center py-12">
          <p class="text-surface-500">No pre-orders found</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-surface-200 bg-surface-50">
                <th class="px-4 py-2.5 text-left font-semibold text-surface-600">Pre-Order</th>
                <th class="px-4 py-2.5 text-left font-semibold text-surface-600">Article</th>
                <th class="px-4 py-2.5 text-left font-semibold text-surface-600">Size</th>
                <th class="px-4 py-2.5 text-right font-semibold text-surface-600">Total Pcs</th>
                <th class="px-4 py-2.5 text-right font-semibold text-surface-600">Cutting Done</th>
                <th class="px-4 py-2.5 text-right font-semibold text-surface-600">Remaining</th>
                <th class="px-4 py-2.5 text-right font-semibold text-surface-600">Distributed</th>
                <th class="px-4 py-2.5 text-right font-semibold text-surface-600">Deposited</th>
                <th class="px-4 py-2.5 text-left font-semibold text-surface-600">Deadline</th>
                <th class="px-4 py-2.5 text-left font-semibold text-surface-600">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="po in preOrders" :key="po.id" class="border-b border-surface-100 hover:bg-surface-50/50 transition-colors">
                <td class="px-4 py-2.5 whitespace-nowrap min-w-[160px] font-medium text-surface-800">{{ po.name }}</td>
                <td class="px-4 py-2.5">{{ po.article?.name || '-' }}</td>
                <td class="px-4 py-2.5"><Badge variant="default" size="sm">{{ po.size?.abbreviation || '-' }}</Badge></td>
                <td class="px-4 py-2.5 text-right">{{ po.total_pcs }}</td>
                <td class="px-4 py-2.5 text-right">{{ po.cut_qty }}</td>
                <td class="px-4 py-2.5 text-right"><Badge :variant="po.cutting_remaining > 0 ? 'success' : 'danger'" size="sm">{{ po.cutting_remaining }}</Badge></td>
                <td class="px-4 py-2.5 text-right">{{ po.distributed_qty }}</td>
                <td class="px-4 py-2.5 text-right">{{ po.deposited_qty }}</td>
                <td class="px-4 py-2.5 whitespace-nowrap">{{ po.deadline_date ? new Date(po.deadline_date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-' }}</td>
                <td class="px-4 py-2.5"><Badge :variant="statusBadge(po.status)" size="sm">{{ statusLabel(po.status) }}</Badge></td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </template>
  </div>
</template>