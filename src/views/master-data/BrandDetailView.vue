<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { Card, Badge, Table } from 'ui-assets'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const { request } = useApi()

const isClient = computed(() => auth.isClient)
const userBrands = computed(() => auth.userBrands)

const loading = ref(true)
const brand = ref(null)
const preOrders = ref([])

const columns = computed(() => {
  if (isClient.value) {
    return [
      { key: 'name', label: t('common.name'), sortable: true },
      { key: 'total_pcs', label: t('common.totalPcs'), sortable: true },
      { key: 'shipped_qty', label: t('brandDetail.shipped'), sortable: true },
      { key: 'shipment_remaining', label: t('brandDetail.shipmentRemaining') },
      { key: 'shipment_progress', label: t('brandDetail.shipmentProgress') },
      { key: 'pre_order_date', label: t('brandDetail.orderDate') },
      { key: 'deadline_date', label: t('brandDetail.deadline') },
      { key: 'completed_date', label: t('common.completedDate') },
      { key: 'status', label: t('brandDetail.status') },
    ]
  }
  return [
    { key: 'name', label: t('common.name'), sortable: true },
    { key: 'total_pcs', label: t('common.totalPcs'), sortable: true },
    { key: 'cut_qty', label: t('brandDetail.cuttingDone'), sortable: true },
    { key: 'distributed_qty', label: t('brandDetail.distributed'), sortable: true },
    { key: 'deposited_qty', label: t('brandDetail.deposited'), sortable: true },
    { key: 'progress', label: t('brandDetail.progress') },
    { key: 'pre_order_date', label: t('brandDetail.orderDate') },
    { key: 'deadline_date', label: t('brandDetail.deadline') },
    { key: 'completed_date', label: t('common.completedDate') },
    { key: 'status', label: t('brandDetail.status') },
  ]
})

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
  if (status === 'done') return t('common.done')
  if (status === 'overdue') return t('common.overdue')
  return t('common.inProgress')
}

const formatDate = (date) => {
  return date ? new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}

const getProgress = (row) => {
  if (!row.total_pcs || row.total_pcs === 0) return 0
  return Math.round((row.deposited_qty || 0) / row.total_pcs * 100)
}

const getShipmentProgress = (row) => {
  if (!row.total_pcs || row.total_pcs === 0) return 0
  return Math.round((row.shipped_qty || 0) / row.total_pcs * 100)
}

function goToPreOrder(row) {
  router.push({ name: auth.isClient ? 'client-pre-order-detail' : 'pre-order-detail', params: { id: row.id } })
}

function switchBrand(brandId) {
  router.push({ name: 'brand-detail', params: { id: brandId } })
}

const showBrandSelector = computed(() => {
  return isClient.value && userBrands.value.length > 1
})
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <button v-if="!isClient" @click="router.push({ name: 'brands' })" class="p-2 rounded-lg text-surface-500 hover:bg-surface-100 transition-colors cursor-pointer" :title="t('common.back')">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      </button>
      <div class="flex-1 flex items-center justify-between">
        <h1 class="text-2xl font-bold text-surface-900">{{ t('brandDetail.title') }}</h1>
        <div v-if="showBrandSelector" class="flex items-center gap-2">
          <select
            :value="route.params.id"
            @change="switchBrand($event.target.value)"
            class="rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
          >
            <option v-for="brand in userBrands" :key="brand.id" :value="brand.id">
              {{ brand.name }}
            </option>
          </select>
        </div>
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
          <h2 class="text-lg font-semibold text-surface-900">{{ t('brandDetail.brandInfo') }}</h2>
        </div>
        <div class="px-4 py-3 grid-cols-1 sm:grid-cols-3 gap-4 flex w-full row">
          <div class="mr-4">
            <p class="text-xs text-surface-500">{{ t('brandDetail.phone') }}</p>
            <p class="text-sm font-medium text-surface-800">{{ brand.phone || '-' }}</p>
          </div>
          <div class="mr-4">
            <p class="text-xs text-surface-500">{{ t('brandDetail.address') }}</p>
            <p class="text-sm font-medium text-surface-800">{{ brand.address || '-' }}</p>
          </div>
          <div class="mr-4">
            <p class="text-xs text-surface-500">{{ t('brandDetail.status') }}</p>
            <p class="text-sm font-medium text-surface-800"><Badge :variant="brand.status === 'active' ? 'success' : 'danger'" size="sm">{{ brand.status === 'active' ? t('common.active') : t('common.inactive') }}</Badge></p>
          </div>
        </div>
      </Card>

      <Card variant="bordered">
        <div class="px-4 py-3 border-b border-surface-200">
          <h2 class="text-lg font-semibold text-surface-900">{{ t('brandDetail.preOrders') }}</h2>
        </div>
        <div v-if="preOrders.length === 0" class="text-center py-12">
          <p class="text-surface-500">{{ t('common.noResults') }}</p>
        </div>
        <Table v-else :columns="columns" :rows="preOrders" :per-page="15" clickable @row-click="goToPreOrder" showVerticalBorder>
          <template #name="{ value }"><span class="whitespace-nowrap min-w-40 inline-block font-medium text-surface-800">{{ value }}</span></template>
          <template #total_pcs="{ value }"><span class="block text-right">{{ value }}</span></template>
          <template #cut_qty="{ value }"><span class="block text-right">{{ value }}</span></template>
          <template #distributed_qty="{ value }"><span class="block text-right">{{ value }}</span></template>
          <template #deposited_qty="{ value }"><span class="block text-right">{{ value }}</span></template>
          <template #progress="{ row }">
            <div class="flex items-center gap-2">
              <div style="width: 60px; height: 6px; background: #e5e7eb; border-radius: 9999px; overflow: hidden;">
                <div :style="{ width: `${getProgress(row)}%`, height: '100%', background: '#3b82f6', borderRadius: '9999px' }"></div>
              </div>
              <span style="font-size: 11px; font-weight: 500; color: #374151;">{{ getProgress(row) }}%</span>
            </div>
          </template>
          <template #pre_order_date="{ value }"><span class="whitespace-nowrap">{{ formatDate(value) }}</span></template>
          <template #deadline_date="{ value }"><span class="whitespace-nowrap">{{ formatDate(value) }}</span></template>
          <template #completed_date="{ value }">
            <span v-if="value" class="whitespace-nowrap text-green-600 font-medium">{{ formatDate(value) }}</span>
            <span v-else class="text-surface-400">-</span>
          </template>
          <template #shipped_qty="{ value }"><span class="block text-right">{{ value ?? 0 }}</span></template>
          <template #shipment_remaining="{ row }"><span class="block text-right">{{ row.total_pcs - (row.shipped_qty || 0) }}</span></template>
          <template #shipment_progress="{ row }">
            <div class="flex items-center gap-2">
              <div style="width: 60px; height: 6px; background: #e5e7eb; border-radius: 9999px; overflow: hidden;">
                <div :style="{ width: `${getShipmentProgress(row)}%`, height: '100%', background: '#3b82f6', borderRadius: '9999px' }"></div>
              </div>
              <span style="font-size: 11px; font-weight: 500; color: #374151;">{{ getShipmentProgress(row) }}%</span>
            </div>
          </template>
          <template #status="{ value }"><Badge :variant="statusBadge(value)" size="sm">{{ statusLabel(value) }}</Badge></template>
        </Table>
      </Card>
    </template>
  </div>
</template>