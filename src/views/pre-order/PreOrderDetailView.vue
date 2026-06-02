<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useApi } from '@/composables/useApi'
import { useAuthStore } from '@/stores/auth'
import { Card, Badge, Table, Tabs } from 'ui-assets'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip } from 'chart.js'

ChartJS.register(ArcElement, Tooltip)

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { request } = useApi()
const auth = useAuthStore()

const loading = ref(true)
const preOrder = ref(null)
const summary = ref(null)
const entries = ref([])
const statusFilter = ref('')
const activeTab = ref(auth.isClient ? 'shipment' : 'production')

const filteredEntries = computed(() => {
  if (!statusFilter.value) return entries.value
  return entries.value.filter(e => e.status === statusFilter.value)
})

const statusFilters = computed(() => [
  { value: '', label: t('preOrderDetail.filterAll') },
  { value: 'done', label: t('preOrderDetail.filterDone') },
  { value: 'in_progress', label: t('preOrderDetail.filterInProgress') },
  { value: 'overdue', label: t('preOrderDetail.filterOverdue') },
])

function filterBadgeVariant(filter) {
  if (filter === statusFilter.value) {
    if (filter === '') return 'primary'
    return statusBadge(filter)
  }
  return 'default'
}

const columns = computed(() => [
  { key: 'name', label: t('preOrderDetail.title') },
  { key: 'article', label: t('common.article') },
  { key: 'size', label: t('common.size') },
  { key: 'total_pcs', label: t('preOrders.totalPcs') },
  { key: 'cut_qty', label: t('preOrderDetail.cuttingDone') },
  { key: 'cutting_remaining', label: t('preOrderDetail.remaining') },
  { key: 'distributed_qty', label: t('preOrderDetail.distributed') },
  { key: 'deposited_qty', label: t('preOrderDetail.deposited') },
  { key: 'progress', label: t('brandDetail.progress') },
  { key: 'delivered', label: t('preOrderDetail.delivered'), tooltip: t('preOrderDetail.deliveredTooltip') },
  { key: 'not_delivered', label: t('preOrderDetail.notDelivered'), tooltip: t('preOrderDetail.notDeliveredTooltip') },
  { key: 'deadline_date', label: t('preOrderDetail.deadline') },
  { key: 'status', label: t('preOrderDetail.status') },
])

onMounted(async () => {
  try {
    const res = await request(`/pre-orders/${route.params.id}/detail-stats`)
    preOrder.value = res.pre_order
    summary.value = {
      ...res.summary,
      cutting_left: res.summary.cut_qty - res.summary.distributed_qty,
      total_shipped: res.entries.reduce((sum, e) => sum + (e.shipped_qty || 0), 0),
      shipment_remaining: res.entries.reduce((sum, e) => sum + (e.total_pcs - (e.shipped_qty || 0)), 0)
    }

    // Sort entries: first by article's max cutting_remaining (descending), then by article name (group same articles), then by entry's cutting_remaining descending
    entries.value = res.entries.sort((a, b) => {
      const articleA = a.article?.name?.toLowerCase() || ''
      const articleB = b.article?.name?.toLowerCase() || ''

      if (articleA !== articleB) {
        // Get max cutting_remaining for each article
        const maxA = res.entries.filter(e => e.article?.name?.toLowerCase() === articleA).reduce((max, e) => Math.max(max, e.cutting_remaining), 0)
        const maxB = res.entries.filter(e => e.article?.name?.toLowerCase() === articleB).reduce((max, e) => Math.max(max, e.cutting_remaining), 0)

        // Sort by max cutting_remaining descending
        if (maxA !== maxB) {
          return maxB - maxA
        }

        // If same max, sort by article name
        return articleA.localeCompare(articleB)
      }

      // Same article, sort by cutting_remaining descending
      return b.cutting_remaining - a.cutting_remaining
    })
  } catch {
    router.push(auth.isClient && auth.userBrands.length > 0
      ? { name: 'client-brand-detail', params: { id: auth.userBrands[0].id } }
      : { name: 'brands' })
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

const productionColumns = computed(() => [
  { key: 'name', label: t('preOrderDetail.title') },
  { key: 'article', label: t('common.article') },
  { key: 'size', label: t('common.size') },
  { key: 'total_pcs', label: t('preOrders.totalPcs') },
  { key: 'cut_qty', label: t('preOrderDetail.cuttingDone') },
  { key: 'cutting_remaining', label: t('preOrderDetail.remaining') },
  { key: 'distributed_qty', label: t('preOrderDetail.distributed') },
  { key: 'deposited_qty', label: t('preOrderDetail.deposited') },
  { key: 'progress', label: t('brandDetail.progress') },
  { key: 'deadline_date', label: t('preOrderDetail.deadline') },
])

const shipmentColumns = computed(() => [
  { key: 'name', label: t('preOrderDetail.title') },
  { key: 'article', label: t('common.article') },
  { key: 'size', label: t('common.size') },
  { key: 'total_pcs', label: t('preOrders.totalPcs') },
  { key: 'shipped_qty', label: t('preOrderDetail.delivered') },
  { key: 'remaining_ship', label: t('shipments.remaining') },
  { key: 'progress', label: t('brandDetail.progress') },
  { key: 'status', label: t('preOrderDetail.status') },
])

const tabs = computed(() => {
  if (auth.isClient) return [{ key: 'shipment', label: t('nav.shipments') }]
  return [
    { key: 'production', label: t('nav.production') },
    { key: 'shipment', label: t('nav.shipments') },
  ]
})

const formatDate = (date) => {
  return date ? new Date(date).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'
}

const getProgress = (row) => {
  if (!row.cut_qty || row.cut_qty === 0) return 0
  return Math.round((row.deposited_qty || 0) / row.cut_qty * 100)
}

const getShipmentProgress = (row) => {
  if (!row.total_pcs || row.total_pcs === 0) return 0
  return Math.round((row.shipped_qty || 0) / row.total_pcs * 100)
}

const daysLeft = computed(() => {
  if (!preOrder.value?.deadline_date) return null
  const diff = new Date(preOrder.value.deadline_date) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
})

const shipmentChartData = computed(() => {
  const shipped = summary.value?.total_shipped ?? 0
  const total = summary.value?.total_pcs ?? 0
  const remaining = Math.max(total - shipped, 0)
  return {
    datasets: [{
      data: [shipped, remaining],
      backgroundColor: ['#3b82f6', '#e5e7eb'],
      borderWidth: 0,
      hoverOffset: 4,
    }],
  }
})

const shipmentChartOptions = {
  cutout: '72%',
  plugins: { tooltip: { enabled: false } },
  animation: { animateRotate: true },
}

function groupByTailor(distributions) {
  if (!distributions || distributions.length === 0) return []
  const map = new Map()
  for (const dist of distributions) {
    const key = dist.tailor?.id || '_none'
    if (!map.has(key)) {
      map.set(key, {
        tailor: dist.tailor,
        distributions: [],
        total_cutting: 0,
        total_deposited: 0,
      })
    }
    const group = map.get(key)
    group.distributions.push(dist)
    group.total_cutting += dist.total_cutting
    group.total_deposited += dist.total_cutting - dist.deposit_remaining
  }
  return Array.from(map.values())
}
</script>

<template>
  <div>
    <div class="flex items-center gap-3 mb-6">
      <button @click="router.back()" class="p-2 rounded-lg text-surface-500 hover:bg-surface-100 transition-colors cursor-pointer" :title="t('common.back')">
        <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7"/></svg>
      </button>
      <div>
        <h1 class="text-2xl font-bold text-surface-900">{{ preOrder?.name || t('preOrderDetail.title') }}</h1>
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
      <div class="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        <Card variant="bordered" class="text-center py-4 bg-red">
          <p class="text-2xl font-bold text-surface-900">{{ summary.total_pcs }}</p>
          <p class="text-xs text-surface-500 mt-1">{{ t('common.totalPcs') }}</p>
        </Card>
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900">{{ summary.cut_qty }}</p>
          <p class="text-xs text-surface-500 mt-1">{{ t('preOrderDetail.cuttingDone') }}</p>
        </Card>
        <Card variant="bordered" class="text-center py-4 bg-red-400!">
          <p class="text-2xl font-bold">{{ summary.cutting_left }}</p>
          <p class="text-xs mt-1">{{ t('preOrderDetail.cuttingLeft') }}</p>
        </Card>
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900">{{ summary.distributed_qty }}</p>
          <p class="text-xs text-surface-500 mt-1">{{ t('preOrderDetail.distributed') }}</p>
        </Card>
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900">{{ summary.deposited_qty }}</p>
          <p class="text-xs text-surface-500 mt-1">{{ t('preOrderDetail.deposited') }}</p>
        </Card>
      </div>

      <!-- <div class="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900">{{ summary.total_shipped }}</p>
          <p class="text-xs text-surface-500 mt-1">{{ t('preOrderDetail.totalShipped') }}</p>
        </Card>
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold">{{ summary.shipment_remaining }}</p>
          <p class="text-xs mt-1">{{ t('preOrderDetail.shipmentRemaining') }}</p>
        </Card>
        <Card variant="bordered" class="text-center py-4">
          <p class="text-2xl font-bold text-surface-900">{{ summary.total_pcs }}</p>
          <p class="text-xs text-surface-500 mt-1">{{ t('common.totalPcs') }}</p>
        </Card>
      </div> -->

      <div class="flex justify-center items-center gap-6 px-6 py-4">
        <!-- Shipment progress doughnut -->
        <Card variant="bordered" class="mb-6 min-w-fit" contentClass="px-6 py-4 flex">
          <div class="relative w-40 h-40 shrink-0 mr-4">
            <Doughnut :data="shipmentChartData" :options="shipmentChartOptions" />
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-3xl  font-bold text-surface-800">
                {{ summary.total_pcs > 0 ? Math.round(summary.total_shipped / summary.total_pcs * 100) : 0 }}%
              </span>
            </div>
          </div>
          <div class="mr-6 flex flex-col justify-center">
            <div class="flex items-center text-blue-600">
              <p class="text-3xl font-bold mr-2">{{ summary.total_shipped }}</p>
              <p class="text-xs h-fit">{{ t('preOrderDetail.totalShipped') }}</p>
            </div>
            <div class="flex items-center">
              <p class="text-3xl font-bold text-surface-900 mr-2">{{ summary.total_pcs }}</p>
              <p class="text-xs text-surface-500 h-fit">{{ t('common.totalPcs') }}</p>
            </div>
            <div class="flex items-center text-orange-400!">
              <p class="text-3xl font-bold mr-2">{{ summary.shipment_remaining }}</p>
              <p class="text-xs h-fit">{{ t('preOrderDetail.shipmentRemaining') }}</p>
            </div>
            <!-- <p class="text-xs text-surface-400 mt-0.5">{{ t('common.of') }} {{ summary.total_pcs }} {{ t('common.pcs') }}</p> -->
          </div>
        </Card>

        <div class="w-px h-10 bg-surface-200 shrink-0"></div>

        <!-- Deadline countdown -->
        <Card variant="bordered" class="mb-6 min-w-fit h-48" contentClass="px-6 py-4 h-full">
          <div class="flex flex-col justify-between h-full text-center">
            <p class="text-surface-500">{{ t('preOrderDetail.deadline') }}</p>
            <p class="text-6xl font-bold"
              :class="daysLeft !== null && daysLeft <= 0 ? 'text-red-600' : daysLeft !== null && daysLeft <= 7 ? 'text-amber-600' : 'text-surface-900'">
              {{ daysLeft !== null ? (daysLeft <= 0 ? t('preOrderDetail.overdue') : daysLeft) : '-' }}
            </p>
            <p class="text-xs text-surface-400">
              {{ daysLeft !== null && daysLeft > 0 ? t('preOrderDetail.daysLeft') : '' }}
              {{ preOrder.deadline_date ? formatDate(preOrder.deadline_date) : '' }}
            </p>
          </div>
        </Card>
      </div>

      <!-- <div class="grid grid-cols-3 gap-4 mb-6">
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
      </div> -->

      <Card variant="bordered">
        <div class="px-4 py-3 border-b border-surface-200">
          <div class="flex items-center justify-between">
            <!-- <h2 class="text-lg font-semibold text-surface-900">{{ t('preOrderDetail.details') }}</h2> -->
            <Tabs v-model="activeTab" :tabs="tabs" />
          </div>
        </div>
        <div v-if="entries.length === 0" class="text-center py-12">
          <p class="text-surface-500">{{ t('preOrderDetail.noEntries') }}</p>
        </div>
        <template v-else>
          <div v-if="activeTab === 'production'" class="px-4 py-2 flex items-center gap-2 border-b border-surface-200">
            <button v-for="f in statusFilters" :key="f.value" @click="statusFilter = f.value" class="cursor-pointer">
              <Badge :variant="filterBadgeVariant(f.value)" size="sm">{{ f.label }}</Badge>
            </button>
          </div>
          <Table v-if="activeTab === 'production'" :columns="productionColumns" :rows="filteredEntries" :per-page="15" expandable showVerticalBorder>
            <template #name="{ value }"><span class="whitespace-nowrap min-w-40 inline-block font-medium text-surface-800">{{ value }}</span></template>
            <template #article="{ value }"><span class="whitespace-nowrap">{{ value?.name || '-' }}</span></template>
            <template #size="{ value }"><Badge variant="default" size="sm">{{ value?.abbreviation || '-' }}</Badge></template>
            <template #total_pcs="{ value }"><span class="block text-right">{{ value }}</span></template>
            <template #cut_qty="{ value }"><span class="block text-right">{{ value }}</span></template>
            <template #cutting_remaining="{ value }"><span class="block text-right"><Badge :variant="value > 0 ? 'danger' : 'success'" size="sm">{{ value }}</Badge></span></template>
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
            <template #deadline_date="{ value }"><span class="whitespace-nowrap">{{ formatDate(value) }}</span></template>
            <template #status="{ value }"><Badge :variant="statusBadge(value)" size="sm">{{ statusLabel(value) }}</Badge></template>
            <template #expanded="{ row }">
              <div v-if="row.distributions && row.distributions.length > 0" class="space-y-3">
                <Card v-for="tg in groupByTailor(row.distributions)" :key="tg.tailor?.id || '_none'" variant="bordered" class="shadow-none!">
                  <div class="px-4 py-2.5 border-b border-surface-200 flex items-center justify-between bg-surface-50">
                    <div class="flex items-center gap-3">
                      <span class="text-sm font-semibold text-surface-800">{{ tg.tailor?.name || t('preOrderDetail.noTailor') }}</span>
                    </div>
                    <div class="flex items-center gap-4 text-sm">
                      <span class="text-surface-500">{{ t('preOrderDetail.distributed') }}: <span class="text-surface-800 font-medium">{{ tg.total_cutting }}</span></span>
                      <span class="text-surface-500">{{ t('preOrderDetail.deposited') }}: <span class="text-surface-800 font-medium">{{ tg.total_deposited }}</span></span>
                    </div>
                  </div>
                  <div class="divide-y divide-surface-100">
                    <div v-for="dist in tg.distributions" :key="dist.id" class="px-4 py-2.5">
                      <div class="flex items-center justify-between mb-1.5">
                        <div class="flex items-center gap-2">
                          <span class="text-sm font-medium text-surface-700">{{ dist.name }}</span>
                          <Badge :variant="statusBadge(dist.status)" size="sm">{{ statusLabel(dist.status) }}</Badge>
                        </div>
                        <div class="flex items-center gap-3 text-sm">
                          <span class="text-surface-500">{{ t('preOrderDetail.cut') }}: <span class="text-surface-800 font-medium">{{ dist.total_cutting }}</span></span>
                          <span class="text-surface-500">{{ t('common.remaining') }}: <Badge :variant="dist.deposit_remaining > 0 ? 'warning' : 'success'" size="sm">{{ dist.deposit_remaining }}</Badge></span>
                        </div>
                      </div>
                      <div v-if="dist.deposits && dist.deposits.length > 0" class="ml-3 flex flex-wrap gap-2">
                        <div v-for="dep in dist.deposits" :key="dep.id" class="flex items-center gap-1.5 text-xs bg-surface-50 px-2 py-1 rounded">
                          <span class="text-surface-600">{{ formatDate(dep.deposit_date) }}</span>
                          <span class="font-semibold text-surface-800">{{ dep.total_sewing_result }} {{ t('common.pcs') }}</span>
                          <Badge :variant="statusBadge(dep.status)" size="sm">{{ statusLabel(dep.status) }}</Badge>
                        </div>
                      </div>
                      <p v-else class="text-xs text-surface-400 ml-3">{{ t('preOrderDetail.noDeposits') }}</p>
                    </div>
                  </div>
                </Card>
              </div>
              <div v-else class="text-sm text-surface-400">{{ t('preOrderDetail.noDistributions') }}</div>
            </template>
          </Table>
          <Table v-else :columns="shipmentColumns" :rows="entries" :per-page="15" showVerticalBorder>
            <template #name="{ value }"><span class="whitespace-nowrap min-w-40 inline-block font-medium text-surface-800">{{ value }}</span></template>
            <template #article="{ value }"><span class="whitespace-nowrap">{{ value?.name || '-' }}</span></template>
            <template #size="{ value }"><Badge variant="default" size="sm">{{ value?.abbreviation || '-' }}</Badge></template>
            <template #total_pcs="{ value }"><span class="block text-right">{{ value }}</span></template>
            <template #shipped_qty="{ value }"><span class="block text-right">{{ value ?? 0 }}</span></template>
            <template #remaining_ship="{ row }"><span class="block text-right"><Badge :variant="(row.total_pcs - (row.shipped_qty ?? 0)) > 0 ? 'danger' : 'success'" size="sm">{{ row.total_pcs - (row.shipped_qty ?? 0) }}</Badge></span></template>
            <template #progress="{ row }">
              <div class="flex items-center gap-2">
                <div style="width: 60px; height: 6px; background: #e5e7eb; border-radius: 9999px; overflow: hidden;">
                  <div :style="{ width: `${getShipmentProgress(row)}%`, height: '100%', background: '#3b82f6', borderRadius: '9999px' }"></div>
                </div>
                <span style="font-size: 11px; font-weight: 500; color: #374151;">{{ getShipmentProgress(row) }}%</span>
              </div>
            </template>
            <template #status="{ value }"><Badge :variant="statusBadge(value)" size="sm">{{ statusLabel(value) }}</Badge></template>
          </Table>
        </template>
      </Card>
    </template>
  </div>
</template>
