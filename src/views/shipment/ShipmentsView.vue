<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMasterData } from '@/composables/useMasterData'
import { useApi } from '@/composables/useApi'
import { useDebounce } from '@/composables/useDebounce'
import { usePersistentFilters } from '@/composables/usePersistentFilters'
import { Button, Card, Table, Badge, Input, Modal, SearchableDropdown } from 'ui-assets'

const { t } = useI18n()

const { search, brandFilter } = usePersistentFilters('shipments-filters', {
  search: '',
  brandFilter: ''
})
const { debounce } = useDebounce(500)

const { items, loading, fetchData } = useMasterData('/pre-orders', () => ({ search: search.value, brand_filter: brandFilter.value }), { perPage: 1000000 })

watch([search, brandFilter], () => debounce(() => fetchData(1)))

const { request } = useApi()
const filterBrands = ref([])

onMounted(async () => {
  try {
    const res = await request('/brands?per_page=1000000')
    filterBrands.value = res.data.map(b => ({ value: b.id, label: b.name }))
  } catch { /* ignore */ }
})

const shipmentForm = ref(null)
const shipmentSubmitting = ref(false)
const shipmentError = ref('')
const shipmentFormStyle = ref({})
const shipmentFormRef = ref(null)

const shipmentDetailForm = ref(null)
const shipmentDetailSubmitting = ref(false)
const shipmentDetailError = ref('')
const editingShipment = ref(null)
const showShipmentDetailModal = ref(false)
const showDeleteModal = ref(false)
const deletingShipmentId = ref(null)

function openShipmentForm(entry, group, event) {
  const today = new Date().toISOString().split('T')[0]
  const remaining = entry.total_pcs - (entry.shipped ?? 0)
  shipmentForm.value = {
    pre_order_id: entry.id,
    shipment_date: today,
    total_shipment: '',
    remaining: remaining > 0 ? remaining : 0,
  }
  shipmentError.value = ''
  nextTick(() => positionShipmentForm(event))
}

function positionShipmentForm(event) {
  const btnRect = event.currentTarget.getBoundingClientRect()
  shipmentFormStyle.value = {
    top: `${btnRect.bottom + 4}px`,
    left: `${Math.max(8, Math.min(btnRect.left, window.innerWidth - 288))}px`,
  }
  nextTick(() => {
    if (!shipmentFormRef.value) return
    const formRect = shipmentFormRef.value.getBoundingClientRect()
    const spaceBelow = window.innerHeight - btnRect.bottom
    const spaceAbove = btnRect.top
    let top
    if (spaceBelow >= formRect.height) {
      top = btnRect.bottom + 4
    } else if (spaceAbove >= formRect.height) {
      top = btnRect.top - formRect.height - 4
    } else {
      top = Math.max(8, window.innerHeight - formRect.height - 8)
    }
    shipmentFormStyle.value = {
      top: `${top}px`,
      left: `${Math.max(8, Math.min(btnRect.left, window.innerWidth - 288))}px`,
    }
  })
}

function closeShipmentForm() {
  shipmentForm.value = null
  shipmentSubmitting.value = false
  shipmentError.value = ''
  shipmentFormStyle.value = {}
}

async function submitShipment() {
  if (!shipmentForm.value) return
  const f = shipmentForm.value
  if (!f.total_shipment || Number(f.total_shipment) <= 0) {
    shipmentError.value = t('shipments.shipmentQtyGreater0')
    return
  }
  if (Number(f.total_shipment) > f.remaining) {
    shipmentError.value = t('shipments.shipmentQtyExceeds')
    return
  }
  if (!f.shipment_date) {
    shipmentError.value = t('shipments.shipmentDateRequired')
    return
  }
  shipmentSubmitting.value = true
  shipmentError.value = ''
  try {
    const res = await request('/shipments', {
      method: 'POST',
      body: JSON.stringify({
        pre_order_id: f.pre_order_id,
        shipment_date: f.shipment_date,
        total_shipment: Number(f.total_shipment),
      }),
    })
    const qty = Number(f.total_shipment)
    const group = groupedOrders.value.find(g => g.articles.some(a => a.entries.some(e => e.id === f.pre_order_id)))
    if (group) {
      const entry = group.articles.flatMap(a => a.entries).find(e => e.id === f.pre_order_id)
      if (entry) {
        entry.shipped = (entry.shipped ?? 0) + qty
        entry.remaining_ship = (entry.remaining_ship ?? entry.total_pcs) - qty
        if (!entry.shipments) entry.shipments = []
        entry.shipments.push({
          id: res.id,
          total_shipment: qty,
          shipment_date: f.shipment_date,
        })
      }
    }
    closeShipmentForm()
  } catch (e) {
    shipmentError.value = e.message
  } finally {
    shipmentSubmitting.value = false
  }
}

function handleShipmentFormClickOutside() {}

onUnmounted(() => {
  document.removeEventListener('click', handleShipmentFormClickOutside, true)
})

onMounted(() => {
  document.addEventListener('click', handleShipmentFormClickOutside, true)
})

const tooltipData = ref(null)
const tooltipStyle = ref({})

function showTooltip(entry, event) {
  if (!entry.shipments || entry.shipments.length === 0) return
  const rect = event.currentTarget.getBoundingClientRect()
  tooltipData.value = entry.shipments
  tooltipStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${Math.max(8, rect.left - 40)}px`,
  }
}

function hideTooltip() {
  tooltipData.value = null
  tooltipStyle.value = {}
}

function openShipmentDetailForm(entry) {
  shipmentDetailForm.value = {
    pre_order_id: entry.id,
    total_pcs: entry.total_pcs,
    shipments: [...(entry.shipments || [])],
  }
  shipmentDetailError.value = ''
  editingShipment.value = null
  showShipmentDetailModal.value = true
}

function closeShipmentDetailForm() {
  shipmentDetailForm.value = null
  shipmentDetailSubmitting.value = false
  shipmentDetailError.value = ''
  editingShipment.value = null
  showShipmentDetailModal.value = false
}

function startEditShipment(shipment) {
  editingShipment.value = {
    id: shipment.id,
    total_shipment: String(shipment.total_shipment),
    shipment_date: shipment.shipment_date,
  }
}

function cancelEditShipment() {
  editingShipment.value = null
}

async function updateShipment() {
  if (!editingShipment.value) return
  const f = editingShipment.value
  if (!f.total_shipment || Number(f.total_shipment) <= 0) {
    shipmentDetailError.value = t('shipments.shipmentQtyGreater0')
    return
  }
  if (!f.shipment_date) {
    shipmentDetailError.value = t('shipments.shipmentDateRequired')
    return
  }

  const otherShipmentsTotal = shipmentDetailForm.value?.shipments
    .filter(s => s.id !== f.id)
    .reduce((sum, s) => sum + s.total_shipment, 0) ?? 0

  const newTotalShipped = otherShipmentsTotal + Number(f.total_shipment)
  if (newTotalShipped > shipmentDetailForm.value.total_pcs) {
    shipmentDetailError.value = t('shipments.shipmentQtyExceeds')
    return
  }

  shipmentDetailSubmitting.value = true
  shipmentDetailError.value = ''
  try {
    await request(`/shipments/${f.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        shipment_date: f.shipment_date,
        total_shipment: Number(f.total_shipment),
      }),
    })
    await fetchData(1)
    closeShipmentDetailForm()
  } catch (e) {
    shipmentDetailError.value = e.message
  } finally {
    shipmentDetailSubmitting.value = false
  }
}

async function deleteShipment(shipmentId) {
  deletingShipmentId.value = shipmentId
  showDeleteModal.value = true
}

async function confirmDelete() {
  if (!deletingShipmentId.value) return
  try {
    await request(`/shipments/${deletingShipmentId.value}`, { method: 'DELETE' })
    await fetchData(1)
    closeShipmentDetailForm()
    showDeleteModal.value = false
  } catch { /* ignore */ }
}

function closeDeleteModal() {
  showDeleteModal.value = false
  deletingShipmentId.value = null
}

const groupedOrders = computed(() => {
  const map = new Map()
  for (const item of items.value) {
    if (!map.has(item.name)) {
      map.set(item.name, {
        id: item.id,
        name: item.name,
        brand: item.brand,
        brand_id: item.brand_id,
        pre_order_date: item.pre_order_date,
        deadline_date: item.deadline_date,
        total_pcs: 0,
        articles: [],
        rawIds: [],
      })
    }
    const group = map.get(item.name)

    let articleGroup = group.articles.find(a => a.article_id === item.article_id)
    if (!articleGroup) {
      articleGroup = { article_id: item.article_id, article: item.article, entries: [] }
      group.articles.push(articleGroup)
    }

    const deposited = item.deposited_qty ?? 0
    const shipped = item.shipments?.reduce((sum, s) => sum + s.total_shipment, 0) ?? 0
    const remainingShip = item.total_pcs - shipped

    articleGroup.entries.push({ 
      id: item.id, 
      size: item.size, 
      size_id: item.size_id, 
      total_pcs: item.total_pcs, 
      deposited_qty: deposited,
      shipped: shipped,
      remaining_ship: remainingShip,
      shipments: item.shipments || []
    })
    group.total_pcs += Number(item.total_pcs)
    group.rawIds.push(item.id)
  }
  return Array.from(map.values())
})

const columns = computed(() => [
  { key: 'brand', label: t('common.brand') },
  { key: 'name', label: t('preOrders.preOrderName') },
  { key: 'pre_order_date', label: t('preOrders.orderDate') },
  { key: 'deadline_date', label: t('preOrders.deadline') },
  { key: 'total_pcs', label: t('preOrders.totalPcs') },
  { key: 'shipped', label: t('shipments.shipped') },
  { key: 'remaining', label: t('shipments.remaining') },
  { key: 'progress', label: t('brandDetail.progress') },
])

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getShipped(row) {
  return row.articles.reduce((sum, ag) => {
    return sum + ag.entries.reduce((s, e) => s + (e.shipped ?? 0), 0)
  }, 0)
}

function getRemainingShip(row) {
  return row.articles.reduce((sum, ag) => {
    return sum + ag.entries.reduce((s, e) => s + (e.remaining_ship ?? 0), 0)
  }, 0)
}

function getProgress(row) {
  if (!row.total_pcs || row.total_pcs === 0) return 0
  const shipped = getShipped(row)
  return Math.round((shipped / row.total_pcs) * 100)
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-surface-900">{{ t('shipments.title') }}</h1>
        <p class="mt-1 text-sm text-surface-500">{{ t('shipments.description') }}</p>
      </div>
    </div>

    <div class="flex flex-col sm:flex-row gap-3 mb-4">
      <div class="sm:w-64">
        <SearchableDropdown
          v-model="brandFilter"
          :options="filterBrands"
          label=""
          :placeholder="t('common.allBrands')"
          clearable
        />
      </div>
      <div class="flex-1">
        <Input v-model="search" label="" :placeholder="t('preOrders.searchPlaceholder')" />
      </div>
    </div>

    <Card variant="bordered">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      <div v-else-if="items.length === 0" class="text-center py-12">
        <p class="text-surface-500">{{ t('shipments.noPreOrders') }}</p>
      </div>
      <template v-else>
        <Table :columns="columns" :rows="groupedOrders" expandable :per-page="15" showVerticalBorder>
          <template #name="{ row }">
            <span class="whitespace-nowrap min-w-40 inline-block">{{ row.name }}</span>
          </template>
          <template #brand="{ row }">
            <Badge variant="primary" size="sm">{{ row.brand?.name || '-' }}</Badge>
          </template>
          <template #pre_order_date="{ row }">
            {{ formatDate(row.pre_order_date) }}
          </template>
          <template #deadline_date="{ row }">
            {{ formatDate(row.deadline_date) }}
          </template>
          <template #total_pcs="{ row }">
            <span class="text-surface-800 font-medium">{{ row.total_pcs }}</span>
          </template>
          <template #shipped="{ row }">
            <span class="text-surface-800 font-medium">{{ getShipped(row) }}</span>
          </template>
          <template #remaining="{ row }">
            <Badge :variant="getRemainingShip(row) > 0 ? 'danger' : 'success'" size="sm">{{ getRemainingShip(row) > 0 ? getRemainingShip(row) : t('shipments.paid') }}</Badge>
          </template>
          <template #progress="{ row }">
            <div class="flex items-center gap-2">
              <div style="width: 60px; height: 6px; background: #e5e7eb; border-radius: 9999px; overflow: hidden;">
                <div :style="{ width: `${getProgress(row)}%`, height: '100%', background: '#3b82f6', borderRadius: '9999px' }"></div>
              </div>
              <span style="font-size: 11px; font-weight: 500; color: #374151;">{{ getProgress(row) }}%</span>
            </div>
          </template>
          <template #expanded="{ row }">
            <div class="space-y-3">
              <Card v-for="ag in row.articles" :key="ag.article_id" variant="bordered" class="shadow-none!">
                <div class="px-4 py-2 border-b border-surface-200">
                  <span class="text-sm font-medium text-surface-800">{{ ag.article?.name || '-' }}</span>
                </div>
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-surface-200">
                      <th class="py-1.5 px-4 text-left font-medium text-surface-500">{{ t('common.size') }}</th>
                      <th class="py-1.5 px-4 text-right font-medium text-surface-500">{{ t('preOrders.totalPcs') }}</th>
                      <th class="py-1.5 px-4 text-right font-medium text-surface-500">{{ t('shipments.shipped') }}</th>
                      <th class="py-1.5 px-4 text-right font-medium text-surface-500">{{ t('shipments.remaining') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="entry in ag.entries" :key="entry.id" class="border-b border-surface-100 last:border-0">
                      <td class="py-1.5 px-4"><Badge variant="default" size="sm">{{ entry.size?.abbreviation || '-' }}</Badge></td>
                      <td class="py-1.5 px-4 text-right">{{ entry.total_pcs }}</td>
                      <td class="py-1.5 px-4">
                        <div class="flex items-center justify-end gap-1.5">
                          <span
                            v-if="entry.shipments && entry.shipments.length > 0"
                            class="cursor-help text-surface-800 font-medium"
                            @mouseenter="showTooltip(entry, $event)"
                            @mouseleave="hideTooltip"
                          >{{ entry.shipped }}</span>
                          <span v-else class="text-surface-800 font-medium">{{ entry.shipped ?? 0 }}</span>
                          <button
                            v-if="entry.shipments && entry.shipments.length > 0"
                            @click="openShipmentDetailForm(entry)"
                            class="p-1 rounded-md transition-colors cursor-pointer text-surface-600 hover:bg-surface-100"
                            :title="t('common.edit')"
                          >
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                          <button
                            data-shipment-btn
                            @click="entry.remaining_ship > 0 && shipmentForm?.pre_order_id !== entry.id ? openShipmentForm(entry, row, $event) : (shipmentForm?.pre_order_id === entry.id ? closeShipmentForm() : null)"
                            :disabled="entry.remaining_ship <= 0"
                            class="p-1 rounded-md transition-colors cursor-pointer"
                            :class="entry.remaining_ship > 0 ? 'text-primary-600 hover:bg-primary-50' : 'text-surface-300 cursor-not-allowed'"
                            :title="t('shipments.addShipment')"
                          >
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                          </button>
                        </div>
                      </td>
                      <td class="py-1.5 px-4 text-right"><Badge :variant="entry.remaining_ship > 0 ? 'danger' : 'success'" size="sm">{{ entry.remaining_ship > 0 ? entry.remaining_ship : t('shipments.paid') }}</Badge></td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            </div>
          </template>
        </Table>
      </template>
    </Card>

    <Teleport to="body">
      <div v-if="shipmentForm" ref="shipmentFormRef" class="fixed z-50 bg-white rounded-lg border border-surface-200 p-4 w-72" :style="shipmentFormStyle">
        <div v-if="shipmentError" class="p-2 mb-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{{ shipmentError }}</div>
        <div class="space-y-3">
          <Input v-model="shipmentForm.shipment_date" :label="t('shipments.shipmentDate')" type="date" required />
          <Input v-model="shipmentForm.total_shipment" :label="t('shipments.shipmentQty')" type="number" placeholder="0" required />
          <div class="flex items-center gap-2 pt-1">
            <Button :loading="shipmentSubmitting" @click="submitShipment" size="sm">{{ t('common.create') }}</Button>
            <Button variant="outline" @click="closeShipmentForm" size="sm">{{ t('common.cancel') }}</Button>
          </div>
        </div>
      </div>
      <div v-if="tooltipData" class="fixed z-50 w-56 p-2 bg-black/80 text-white rounded-lg shadow-lg text-xs" :style="tooltipStyle" @mouseenter="() => {}" @mouseleave="hideTooltip">
        <div v-for="s in tooltipData" :key="s.id" class="flex justify-between py-0.5">
          <span>{{ s.shipment_date ? formatDate(s.shipment_date) : '-' }}</span>
          <span class="font-medium">{{ s.total_shipment }} {{ t('common.pcs') }}</span>
        </div>
      </div>
      <Modal v-model="showShipmentDetailModal" :title="t('shipments.shipmentDetails')" size="md" :closeOnOverlay="false">
        <div v-if="shipmentDetailError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">{{ shipmentDetailError }}</div>
        <div v-if="shipmentDetailForm && shipmentDetailForm.shipments.length === 0" class="text-center py-8 text-surface-400">{{ t('shipments.noShipments') }}</div>
        <div v-else class="space-y-3 max-h-96 overflow-y-auto">
          <div v-for="s in shipmentDetailForm?.shipments || []" :key="s.id" class="p-3 border border-surface-200 rounded-lg">
            <div v-if="editingShipment?.id === s.id" class="space-y-3">
              <Input v-model="editingShipment.shipment_date" :label="t('shipments.shipmentDate')" type="date" required />
              <Input v-model="editingShipment.total_shipment" :label="t('shipments.shipmentQty')" type="number" placeholder="0" required />
              <div class="flex items-center gap-2">
                <Button :loading="shipmentDetailSubmitting" @click="updateShipment" size="sm">{{ t('common.save') }}</Button>
                <Button variant="outline" @click="cancelEditShipment" size="sm">{{ t('common.cancel') }}</Button>
              </div>
            </div>
            <div v-else class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="text-sm text-surface-600">{{ formatDate(s.shipment_date) }}</span>
                <Badge variant="primary" size="sm">{{ s.total_shipment }} {{ t('common.pcs') }}</Badge>
              </div>
              <div class="flex items-center gap-1">
                <button @click="startEditShipment(s)" class="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer" :title="t('common.edit')">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button @click="deleteShipment(s.id)" class="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer" :title="t('common.delete')">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        <template #footer>
          <Button variant="outline" @click="closeShipmentDetailForm">{{ t('common.close') }}</Button>
        </template>
      </Modal>
      <Modal v-model="showDeleteModal" :title="t('common.delete')" size="sm" :closeOnOverlay="false">
        <p class="text-surface-700">{{ t('common.cannotUndo') }}</p>
        <template #footer>
          <div class="flex justify-end gap-3">
            <Button variant="outline" @click="closeDeleteModal">{{ t('common.cancel') }}</Button>
            <Button variant="danger" @click="confirmDelete">{{ t('common.delete') }}</Button>
          </div>
        </template>
      </Modal>
    </Teleport>
  </div>
</template>
