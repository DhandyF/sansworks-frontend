<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useApi } from '@/composables/useApi'
import { useMasterData } from '@/composables/useMasterData'
import { Button, Card, Table, Badge, Input, Modal } from 'ui-assets'

const { t } = useI18n()

const props = defineProps({
  search: String,
  brandFilter: String,
})

const { request } = useApi()
const deposits = useMasterData('/deposit-cutting-results', () => ({ search: props.search, brand_filter: props.brandFilter }), { perPage: 1000000, autoFetch: false })
const { items, loading, fetchData } = deposits

function refresh() { fetchData(1) }
defineExpose({ refresh })

function translateStatus(status) {
  if (status === 'done') return t('common.done')
  if (status === 'overdue') return t('common.overdue')
  if (status === 'in_progress') return t('common.inProgress')
  return status
}

const columns = computed(() => [
  { key: 'name', label: t('common.name') },
  { key: 'brand', label: t('common.brand') },
  { key: 'article', label: t('deposits.article') },
  { key: 'size', label: t('common.size') },
  { key: 'tailor', label: t('common.tailor') },
  { key: 'total_sewing_result', label: t('deposits.sewingResult') },
  { key: 'cutting_price_per_pcs', label: t('deposits.cuttingPricePerPcs') },
  { key: 'total_price', label: t('deposits.totalPrice') },
  { key: 'deposit_date', label: t('deposits.depositDate') },
  { key: 'charge_amount', label: t('deposits.charge') },
  { key: 'status', label: t('common.status') },
  { key: 'actions', label: t('common.actions') },
])

const allDistributions = ref([])
const showDistPicker = ref(false)
const distSearch = ref('')
const distPickerRef = ref(null)
const distTriggerRef = ref(null)
const distDropdownRef = ref(null)

const distOptions = computed(() => {
  const available = allDistributions.value.filter(d => (d.deposit_remaining ?? d.total_cutting) > 0)
  const q = distSearch.value.toLowerCase()
  return q
    ? available.filter(d =>
        d.name?.toLowerCase().includes(q) ||
        d.tailor?.name?.toLowerCase().includes(q) ||
        d.brand?.name?.toLowerCase().includes(q))
    : available
})

async function fetchDistributionOptions() {
  try {
    const res = await request('/cutting-distributions?per_page=1000000')
    allDistributions.value = res.data
  } catch { /* ignore */ }
}

function toggleDistPicker() {
  showDistPicker.value = !showDistPicker.value
  if (showDistPicker.value) {
    distSearch.value = ''
    nextTick(() => {
      const input = distDropdownRef.value?.querySelector('input')
      input?.focus()
    })
  }
}

function selectDist(dist) {
  selectedDist.value = dist
  form.value.cutting_distribution_ids = [dist.id]
  form.value.total_sewing_result = String(dist.deposit_remaining ?? dist.total_cutting)
  showDistPicker.value = false
  distSearch.value = ''
  distRemaining.value = {
    total_cutting: dist.total_cutting,
    deposited: dist.total_cutting - (dist.deposit_remaining ?? dist.total_cutting),
    available: dist.deposit_remaining ?? dist.total_cutting,
  }
  daysDelay.value = 0
  calculatedCharge.value = 0
  calculatedChargePercent.value = 0
  defaultChargePerPcs.value = ''
  form.value.default_charge_per_pcs = ''
  calculateCharge()
}

function handleDistClickOutside(e) {
  if (distPickerRef.value?.contains(e.target)) return
  if (distDropdownRef.value?.contains(e.target)) return
  showDistPicker.value = false
}

onMounted(() => document.addEventListener('click', handleDistClickOutside, true))
onUnmounted(() => document.removeEventListener('click', handleDistClickOutside, true))

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const showForm = ref(false)
const editing = ref(null)
const formError = ref('')
const submitting = ref(false)
const distRemaining = ref(null)

const form = ref({
  cutting_distribution_ids: [],
  cutting_distribution_id: '',
  total_sewing_result: '',
  cutting_price_per_pcs: '',
  deposit_date: '',
  quality_notes: '',
  notes: '',
  default_charge_per_pcs: '',
})
const selectedDist = ref(null)
const selectedDistribution = ref(null)

const daysDelay = ref(0)
const calculatedCharge = ref(0)
const calculatedChargePercent = ref(0)
const defaultChargePerPcs = ref('')

const computedTotalPrice = computed(() => {
  const price = Number(form.value.cutting_price_per_pcs) || 0
  const qty = Number(form.value.total_sewing_result) || 0
  return price * qty
})

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)
}

function calculateCharge() {
  const dist = editing.value ? selectedDistribution.value : selectedDist.value
  if (!dist?.deadline_date || !form.value.deposit_date) {
    daysDelay.value = 0
    calculatedCharge.value = 0
    calculatedChargePercent.value = 0
    return
  }
  const depositDate = new Date(form.value.deposit_date)
  const deadline = new Date(dist.deadline_date)
  daysDelay.value = depositDate > deadline
    ? Math.ceil((depositDate - deadline) / (1000 * 60 * 60 * 24)) : 0

  const qty = Number(form.value.total_sewing_result) || 0
  const defaultCharge = Number(defaultChargePerPcs.value) || 0
  const cutPrice = Number(form.value.cutting_price_per_pcs) || 0

  if (daysDelay.value >= 1 && daysDelay.value <= 3) {
    calculatedCharge.value = defaultCharge * qty
    calculatedChargePercent.value = null
  } else if (daysDelay.value >= 4 && daysDelay.value <= 10) {
    calculatedCharge.value = (defaultCharge * 2) * qty
    calculatedChargePercent.value = null
  } else if (daysDelay.value >= 11) {
    calculatedCharge.value = cutPrice * qty
    calculatedChargePercent.value = 100
  } else {
    calculatedCharge.value = 0
    calculatedChargePercent.value = 0
  }
}

watch([() => form.value.deposit_date, () => form.value.total_sewing_result, () => form.value.cutting_price_per_pcs], calculateCharge)
watch(defaultChargePerPcs, calculateCharge)
watch(() => form.value.default_charge_per_pcs, v => { defaultChargePerPcs.value = v })

function openAddForm() {
  editing.value = null
  const today = new Date().toISOString().split('T')[0]
  form.value = {
    cutting_distribution_ids: [],
    cutting_distribution_id: '',
    total_sewing_result: '',
    cutting_price_per_pcs: '',
    deposit_date: today,
    quality_notes: '',
    notes: '',
    default_charge_per_pcs: '',
  }
  formError.value = ''
  selectedDist.value = null
  distRemaining.value = null
  showDistPicker.value = false
  distSearch.value = ''
  daysDelay.value = 0
  calculatedCharge.value = 0
  calculatedChargePercent.value = 0
  defaultChargePerPcs.value = ''
  fetchDistributionOptions()
  showForm.value = true
}

function openEditForm(item) {
  editing.value = item
  form.value = {
    cutting_distribution_ids: [],
    cutting_distribution_id: item.cutting_distribution_id,
    total_sewing_result: String(item.total_sewing_result),
    cutting_price_per_pcs: String(item.cutting_price_per_pcs ?? ''),
    deposit_date: item.deposit_date ? item.deposit_date.split('T')[0] : '',
    quality_notes: item.quality_notes || '',
    notes: item.notes || '',
    default_charge_per_pcs: String(item.default_charge_per_pcs ?? ''),
  }
  formError.value = ''
  selectedDistribution.value = item.cutting_distribution
  showDistPicker.value = false
  distSearch.value = ''
  distRemaining.value = null
  fetchDistributionOptions()
  if (item.cutting_distribution_id) {
    request(`/cutting-distributions/remaining?cutting_distribution_id=${item.cutting_distribution_id}`).then(res => {
      distRemaining.value = {
        ...res,
        available: res.available + Number(item.total_sewing_result),
      }
    }).catch(() => {})
  }
  showForm.value = true
}

async function handleSubmit() {
  formError.value = ''
  submitting.value = true
  try {
    if (editing.value) {
      const totalSewing = Number(form.value.total_sewing_result)
      if (distRemaining.value && totalSewing > distRemaining.value.available) {
        formError.value = `${t('deposits.sewingResult')} (${totalSewing}) exceeds available distribution quantity (${distRemaining.value.available}).`
        submitting.value = false
        return
      }
      const payload = {
        cutting_distribution_id: form.value.cutting_distribution_id,
        total_sewing_result: totalSewing,
        cutting_price_per_pcs: Number(form.value.cutting_price_per_pcs) || 0,
        deposit_date: form.value.deposit_date,
        quality_notes: form.value.quality_notes || null,
        notes: form.value.notes || null,
        default_charge_per_pcs: form.value.default_charge_per_pcs ? Number(form.value.default_charge_per_pcs) : null,
        charge_amount: calculatedCharge.value || null,
        charge_percent: calculatedChargePercent.value || null,
      }
      await request(`/deposit-cutting-results/${editing.value.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    } else {
      const totalSewing = Number(form.value.total_sewing_result)
      if (distRemaining.value && totalSewing > distRemaining.value.available) {
        formError.value = `${t('deposits.sewingResult')} (${totalSewing}) exceeds available quantity (${distRemaining.value.available}).`
        submitting.value = false
        return
      }
      const payload = {
        distribution_ids: form.value.cutting_distribution_ids,
        total_sewing_result: totalSewing,
        cutting_price_per_pcs: Number(form.value.cutting_price_per_pcs) || 0,
        deposit_date: form.value.deposit_date,
        quality_notes: form.value.quality_notes || null,
        notes: form.value.notes || null,
        default_charge_per_pcs: form.value.default_charge_per_pcs ? Number(form.value.default_charge_per_pcs) : null,
        charge_amount: calculatedCharge.value || null,
        charge_percent: calculatedChargePercent.value || null,
      }
      await request('/deposit-cutting-results/batch', { method: 'POST', body: JSON.stringify(payload) })
    }
    fetchData(1)
    showForm.value = false
  } catch (e) {
    formError.value = e.message
  } finally {
    submitting.value = false
  }
}

const showDeleteModal = ref(false)
const deletingItem = ref(null)

function openDeleteModal(item) { deletingItem.value = item; showDeleteModal.value = true }

async function handleDelete() {
  if (!deletingItem.value) return
  try { await request(`/deposit-cutting-results/${deletingItem.value.id}`, { method: 'DELETE' }) } catch { /* ignore */ }
  showDeleteModal.value = false
  fetchData(1)
  deletingItem.value = null
}

const statusBadge = (value) => {
  if (value === 'done') return 'success'
  if (value === 'overdue') return 'danger'
  return 'warning'
}

function positionDistPicker() {
  if (!distTriggerRef.value) return
  const rect = distTriggerRef.value.getBoundingClientRect()
  const dropdown = distDropdownRef.value
  if (dropdown) {
    dropdown.style.top = `${rect.bottom + 4}px`
    dropdown.style.left = `${rect.left}px`
    dropdown.style.width = `${rect.width}px`
  }
}
</script>

<template>
  <div>
    <div class="flex justify-end mb-4">
      <Button @click="openAddForm">+ {{ t('deposits.addDeposit') }}</Button>
    </div>
    <Card variant="bordered">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      <div v-else-if="items.length === 0" class="text-center py-12">
        <p class="text-surface-500">{{ t('deposits.noResults') }}</p>
      </div>
      <Table v-else :columns="columns" :rows="items" :per-page="15" showVerticalBorder>
        <template #name="{ value }"><span class="whitespace-nowrap font-medium">{{ value || '-' }}</span></template>
        <template #brand="{ value }"><Badge variant="primary" size="sm">{{ value?.name || '-' }}</Badge></template>
        <template #article="{ value }">{{ value?.name || '-' }}</template>
        <template #size="{ value }"><Badge variant="default" size="sm">{{ value?.abbreviation || '-' }}</Badge></template>
        <template #tailor="{ value }">{{ value?.name || '-' }}</template>
        <template #total_sewing_result="{ value }"><span class="font-medium">{{ value }}</span></template>
        <template #cutting_price_per_pcs="{ value }"><span class="block text-right">{{ formatCurrency(value) }}</span></template>
        <template #total_price="{ value }"><span class="font-medium whitespace-nowrap">{{ formatCurrency(value) }}</span></template>
        <template #deposit_date="{ value }"><span class="whitespace-nowrap">{{ formatDate(value) }}</span></template>
        <template #charge_amount="{ row }">
          <span v-if="row.charge_amount > 0" class="text-red-600 font-medium">
            {{ formatCurrency(row.charge_amount) }}
            <span v-if="row.charge_percent" class="text-xs text-surface-500">({{ row.charge_percent }}%)</span>
            <span v-else class="text-xs text-surface-500">({{ formatCurrency(row.default_charge_per_pcs) }}/pcs)</span>
          </span>
          <span v-else class="text-surface-400">-</span>
        </template>
        <template #status="{ row }">
          <Badge :variant="statusBadge(row.status)" size="sm">{{ translateStatus(row.status) }}</Badge>
        </template>
        <template #actions="{ row }">
          <button @click="openEditForm(row)" class="p-1 rounded-lg text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer" :title="t('common.edit')">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
          </button>
          <button @click="openDeleteModal(row)" class="p-1 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer" :title="t('common.delete')">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          </button>
        </template>
      </Table>
    </Card>

    <Modal v-model="showForm" :title="editing ? t('deposits.editDeposit') : t('deposits.addDeposit')" size="lg" :closeOnOverlay="false" contentClass="h-[80vh]">
      <div class="space-y-4">
        <div v-if="formError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{{ formError }}</div>
        <div class="relative" ref="distPickerRef" v-if="!editing">
          <label class="block text-sm font-medium text-surface-700 mb-1">{{ t('deposits.distribution') }} <span class="text-danger">*</span></label>
          <button
            ref="distTriggerRef"
            type="button"
            class="inline-flex items-center gap-2 w-full px-4 py-2 text-sm font-medium bg-white border rounded-lg transition-colors hover:bg-surface-50 cursor-pointer"
            :class="showDistPicker ? 'border-primary-500 ring-2 ring-primary-500/30' : 'border-surface-300'"
            @click="toggleDistPicker"
          >
            <span class="flex-1 truncate text-left" :class="selectedDist ? 'text-surface-800' : 'text-surface-400'">
              {{ selectedDist ? `${selectedDist.name} — ${selectedDist.tailor?.name || ''}` : t('deposits.selectDistribution') }}
            </span>
            <svg class="w-4 h-4 text-surface-500 transition-transform duration-150 shrink-0" :class="{ 'rotate-180': showDistPicker }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
          </button>
          <Teleport to="body">
            <Transition name="dist-picker" @before-enter="positionDistPicker" @enter="positionDistPicker">
              <div
                v-if="showDistPicker"
                ref="distDropdownRef"
                class="fixed z-9999 bg-white border border-surface-200 rounded-xl shadow-lg overflow-hidden"
              >
                <div class="border-b border-surface-200 p-2">
                  <div class="flex items-center gap-2 px-3 py-1.5 bg-surface-50 rounded-lg">
                    <svg class="w-4 h-4 text-surface-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                    <input v-model="distSearch" class="w-full bg-transparent outline-none text-sm placeholder:text-surface-400" :placeholder="t('deposits.searchDistributions')" />
                  </div>
                </div>
                <div v-if="distOptions.length === 0" class="px-4 py-3 text-sm text-surface-400 text-center">{{ t('deposits.noDistributions') }}</div>
                <div v-else class="max-h-72 overflow-y-auto">
                  <div
                    v-for="dist in distOptions"
                    :key="dist.id"
                    class="px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-primary-50"
                    :class="{ 'bg-primary-50 text-primary-700': selectedDist?.id === dist.id }"
                    @click="selectDist(dist)"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2 flex-wrap">
                        <Badge variant="primary" size="sm">{{ dist.brand?.name || '-' }}</Badge>
                        <span class="font-medium text-surface-800">{{ dist.name }}</span>
                        <Badge variant="default" size="sm">{{ dist.size?.abbreviation || '-' }}</Badge>
                        <span class="text-surface-400">—</span>
                        <span>{{ dist.tailor?.name || '-' }}</span>
                      </div>
                      <Badge :variant="(dist.deposit_remaining ?? dist.total_cutting) > 0 ? 'success' : 'danger'" size="sm">
                        {{ t('common.rem') }}: {{ dist.deposit_remaining ?? dist.total_cutting }}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </Teleport>
        </div>
        <div v-else>
          <label class="block text-sm font-medium text-surface-700 mb-1">{{ t('deposits.distribution') }}</label>
          <div class="px-4 py-2 text-sm bg-surface-50 border border-surface-200 rounded-lg text-surface-700">
            {{ selectedDistribution?.name || '-' }} — {{ selectedDistribution?.tailor?.name || '' }}
          </div>
        </div>
        <div v-if="!editing && selectedDist" class="p-3 bg-surface-50 rounded-lg space-y-1 text-sm">
          <p><span class="font-medium">{{ t('common.brand') }}:</span> {{ selectedDist.brand?.name || '-' }}</p>
          <p><span class="font-medium">{{ t('common.tailor') }}:</span> {{ selectedDist.tailor?.name || '-' }}</p>
          <p><span class="font-medium">{{ t('deposits.totalDistributed') }}:</span> {{ selectedDist.total_cutting }}</p>
          <p><span class="font-medium">{{ t('deposits.totalRemaining') }}:</span> <span :class="(selectedDist.deposit_remaining ?? 0) > 0 ? 'text-green-600' : 'text-red-600'" class="font-medium">{{ selectedDist.deposit_remaining ?? 0 }}</span></p>
        </div>
        <div v-if="editing && selectedDistribution" class="p-3 bg-surface-50 rounded-lg space-y-1 text-sm">
          <p><span class="font-medium">{{ t('common.preOrder') }}:</span> {{ selectedDistribution.cutting_result?.pre_order?.name || selectedDistribution.cutting_result?.name || '-' }}</p>
          <p><span class="font-medium">{{ t('common.tailor') }}:</span> {{ selectedDistribution.tailor?.name || '-' }}</p>
          <p><span class="font-medium">{{ t('common.brand') }}:</span> {{ selectedDistribution.brand?.name || '-' }}</p>
          <p><span class="font-medium">{{ t('deposits.article') }}:</span> {{ selectedDistribution.article?.name || '-' }}</p>
          <p><span class="font-medium">{{ t('common.size') }}:</span> {{ selectedDistribution.size?.abbreviation || '-' }}</p>
          <p><span class="font-medium">{{ t('deposits.totalDistributed') }}:</span> {{ selectedDistribution.total_cutting || '-' }}</p>
        </div>
        <div v-if="distRemaining" class="p-3 bg-blue-50 rounded-lg space-y-1 text-sm">
          <p><span class="font-medium">{{ t('deposits.totalDistributed') }}:</span> {{ distRemaining.total_cutting }}</p>
          <p><span class="font-medium">{{ t('deposits.alreadyDeposited') }}:</span> {{ distRemaining.deposited }}</p>
          <p><span class="font-medium">{{ t('deposits.available') }}:</span> <span :class="distRemaining.available > 0 ? 'text-green-600' : 'text-red-600'" class="font-medium">{{ distRemaining.available }}</span></p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input v-model="form.total_sewing_result" :label="t('deposits.sewingResult')" type="number" placeholder="0" required />
          <Input v-model="form.cutting_price_per_pcs" :label="t('deposits.cuttingPricePerPcs')" type="number" placeholder="0" required />
        </div>
        <div class="px-4 py-2 bg-surface-50 border border-surface-200 rounded-lg text-sm">
          <span class="font-medium text-surface-600">{{ t('deposits.totalPrice') }}:</span>
          <span class="ml-2 font-semibold">{{ formatCurrency(computedTotalPrice) }}</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input v-model="form.deposit_date" :label="t('deposits.depositDate')" type="date" required />
        </div>
        <div v-if="daysDelay > 0 && daysDelay < 11" class="grid grid-cols-1 gap-4">
          <Input
            v-model="form.default_charge_per_pcs"
            :label="t('deposits.defaultChargePerPcs')"
            type="number"
            :placeholder="t('deposits.defaultChargePlaceholder')"
            min="0"
          />
          <p class="text-xs text-surface-500 -mt-3">{{ t('deposits.defaultChargeHint') }}</p>
        </div>
        <div v-if="daysDelay > 0" class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <p class="text-amber-800">{{ t('deposits.daysDelayHint', { days: daysDelay }) }}</p>
          <p class="text-amber-800 font-medium mt-1">
            {{ t('deposits.charge') }}: {{ calculatedChargePercent ? calculatedChargePercent + '%' : formatCurrency(calculatedCharge / (Number(form.total_sewing_result) || 1)) + '/pcs' }} = {{ formatCurrency(calculatedCharge) }}
          </p>
        </div>
        <Input v-model="form.quality_notes" :label="t('deposits.qualityNotes')" type="textarea" :placeholder="t('deposits.optionalQualityNotes')" />
        <Input v-model="form.notes" :label="t('common.notes')" type="textarea" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showForm = false">{{ t('common.cancel') }}</Button>
          <Button :loading="submitting" @click="handleSubmit">{{ editing ? t('common.update') : t('common.create') }}</Button>
        </div>
      </template>
    </Modal>

    <Modal v-model="showDeleteModal" :title="t('deposits.deleteTitle')" size="sm" :closeOnOverlay="false">
      <p class="text-surface-700">{{ t('common.confirmDelete') }} <strong>{{ deletingItem?.name }}</strong>? {{ t('common.cannotUndo') }}.</p>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showDeleteModal = false">{{ t('common.cancel') }}</Button>
          <Button variant="danger" @click="handleDelete">{{ t('common.delete') }}</Button>
        </div>
      </template>
    </Modal>
  </div>
</template>

<style>
.dist-picker-enter-active { transition: all 0.15s ease-out; }
.dist-picker-leave-active { transition: all 0.1s ease-in; }
.dist-picker-enter-from, .dist-picker-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
