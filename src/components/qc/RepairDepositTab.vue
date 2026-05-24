<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMasterData } from '@/composables/useMasterData'
import { useApi } from '@/composables/useApi'
import { Button, Card, Table, Badge, Modal, Input, SearchableDropdown } from 'ui-assets'

const { t } = useI18n()

const props = defineProps({
  search: String,
  tailorFilter: String,
})

const { items, loading, fetchData, deleteItem } = useMasterData('/repair-deposits', () => ({
  search: props.search,
  tailor_filter: props.tailorFilter,
}), { perPage: 1000000 })

function refresh() { fetchData(1) }
defineExpose({ refresh })

const { request } = useApi()
const tailors = ref([])
const repairs = ref([])

const showForm = ref(false)
const showDeleteModal = ref(false)
const deletingRef = ref(null)
const formError = ref('')
const submitting = ref(false)

const selectedRepair = ref(null)
const repairInfo = ref(null)
const daysDelay = ref(0)
const calculatedCharge = ref(0)
const calculatedChargePercent = ref(0)

const form = ref({
  repair_id: '',
  tailor_id: '',
  total_deposit: '',
  deposit_date: '',
})

watch(() => form.value.repair_id, async (newVal) => {
  if (!newVal) {
    selectedRepair.value = null
    repairInfo.value = null
    daysDelay.value = 0
    calculatedCharge.value = 0
    calculatedChargePercent.value = 0
    return
  }
  try {
    const res = await request(`/repair-deposits/remaining?repair_id=${newVal}`)
    repairInfo.value = res
  } catch { /* ignore */ }
  try {
    const res = await request(`/repairs/${newVal}`)
    selectedRepair.value = res
    form.value.tailor_id = res.tailor_id
  } catch { /* ignore */ }
})

watch([() => form.value.deposit_date, () => form.value.total_deposit], () => {
  calculateCharge()
})

function calculateCharge() {
  if (!selectedRepair.value || !form.value.deposit_date) {
    daysDelay.value = 0
    calculatedCharge.value = 0
    calculatedChargePercent.value = 0
    return
  }
  const depositDate = new Date(form.value.deposit_date)
  const deadlineDate = new Date(selectedRepair.value.deadline_date)
  daysDelay.value = 0
  if (depositDate > deadlineDate) {
    daysDelay.value = Math.ceil((depositDate - deadlineDate) / (1000 * 60 * 60 * 24))
  }
  const totalValue = (selectedRepair.value.sewing_price || 0) * (Number(form.value.total_deposit) || 0)
  if (daysDelay.value >= 1 && daysDelay.value <= 3) {
    calculatedChargePercent.value = 10
    calculatedCharge.value = totalValue * 0.10
  } else if (daysDelay.value >= 4 && daysDelay.value <= 10) {
    calculatedChargePercent.value = 50
    calculatedCharge.value = totalValue * 0.50
  } else if (daysDelay.value > 10) {
    calculatedChargePercent.value = 100
    calculatedCharge.value = totalValue
  } else {
    calculatedChargePercent.value = 0
    calculatedCharge.value = 0
  }
}

async function openAddForm() {
  const today = new Date().toISOString().split('T')[0]
  form.value = {
    repair_id: '',
    tailor_id: '',
    total_deposit: '',
    deposit_date: today,
  }
  formError.value = ''
  selectedRepair.value = null
  repairInfo.value = null
  daysDelay.value = 0
  calculatedCharge.value = 0
  calculatedChargePercent.value = 0

  try {
    const res = await request('/repairs?per_page=1000000')
    repairs.value = res.data
  } catch { /* ignore */ }

  try {
    const res = await request('/tailors?per_page=1000000')
    tailors.value = res.data.map(t => ({ value: t.id, label: t.name }))
  } catch { /* ignore */ }

  showForm.value = true
}

function openDeleteModal(item) {
  deletingRef.value = item
  showDeleteModal.value = true
}

const repairOptions = computed(() => {
  if (!repairs.value) return []
  return repairs.value.map(r => ({
    value: r.id,
    label: `${r.name} (Sisa: ${r.total_repair - (r.total_deposited ?? 0)} pcs)`,
  }))
})

async function handleSubmit() {
  formError.value = ''
  submitting.value = true

  const selectedRepairData = repairs.value?.find(r => r.id === form.value.repair_id)
  if (selectedRepairData) {
    const remaining = selectedRepairData.total_repair - (selectedRepairData.total_deposited ?? 0)
    if (Number(form.value.total_deposit) > remaining) {
      formError.value = t('repairDeposits.exceedRemaining', { remaining })
      submitting.value = false
      return
    }
  }

  try {
    const payload = {
      repair_id: form.value.repair_id,
      tailor_id: form.value.tailor_id,
      total_deposit: Number(form.value.total_deposit),
      deposit_date: form.value.deposit_date,
    }
    await request('/repair-deposits', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    await fetchData(1)
    showForm.value = false
  } catch (e) {
    formError.value = e.message
  } finally {
    submitting.value = false
  }
}

async function handleDelete() {
  if (!deletingRef.value) return
  try {
    await deleteItem(deletingRef.value.id)
  } catch { /* ignore */ }
  showDeleteModal.value = false
  deletingRef.value = null
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatCurrency(value) {
  return Number(value || 0).toLocaleString('id-ID')
}

const columns = computed(() => [
  { key: 'repair_name', label: t('repairDeposits.repairName') },
  { key: 'tailor', label: t('repairDeposits.tailor') },
  { key: 'brand', label: t('repairDeposits.brand') },
  { key: 'article', label: t('repairDeposits.article') },
  { key: 'sewing_price', label: t('repairDeposits.sewingPrice') },
  { key: 'total_deposit', label: t('repairDeposits.totalDeposit') },
  { key: 'deposit_date', label: t('repairDeposits.depositDate') },
  { key: 'charge_amount', label: t('repairDeposits.charge') },
  { key: 'actions', label: t('common.actions') },
])
</script>

<template>
  <div>
    <div class="flex justify-end mb-4">
      <Button @click="openAddForm">+ {{ t('repairDeposits.addDeposit') }}</Button>
    </div>

    <Card variant="bordered">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      <div v-else-if="items.length === 0" class="text-center py-12">
        <p class="text-surface-500">{{ t('repairDeposits.noDeposits') }}</p>
      </div>
      <template v-else>
        <Table :columns="columns" :rows="items" :per-page="15" showVerticalBorder>
          <template #repair_name="{ row }"><span class="whitespace-nowrap font-medium text-surface-800">{{ row.repair?.name || '-' }}</span></template>
          <template #tailor="{ row }">{{ row.tailor?.name || '-' }}</template>
          <template #brand="{ row }"><Badge variant="primary" size="sm">{{ row.repair?.brand?.name || '-' }}</Badge></template>
          <template #article="{ row }">{{ row.repair?.article?.name || '-' }}</template>
          <template #sewing_price="{ row }"><span class="block text-right">{{ formatCurrency(row.repair?.sewing_price) }}</span></template>
          <template #total_deposit="{ value }"><span class="block text-right">{{ value }}</span></template>
          <template #deposit_date="{ value }">{{ formatDate(value) }}</template>
          <template #charge_amount="{ row }">
            <span v-if="row.charge_amount > 0" class="text-red-600 font-medium">{{ formatCurrency(row.charge_amount) }} <span class="text-xs text-surface-500">({{ row.charge_percent }}%)</span></span>
            <span v-else class="text-surface-400">-</span>
          </template>
          <template #actions="{ row }">
            <button @click.stop="openDeleteModal(row)" class="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer" :title="t('common.delete')">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </template>
        </Table>
      </template>
    </Card>

    <Modal v-model="showForm" :title="t('repairDeposits.addDeposit')" size="lg" :closeOnOverlay="false">
      <div class="space-y-4">
        <div v-if="formError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{{ formError }}</div>

        <div class="grid grid-cols-1 md:grid-cols-1 gap-4">
          <SearchableDropdown v-model="form.repair_id" :options="repairOptions" :label="t('repairDeposits.repairName')" :placeholder="t('repairDeposits.selectRepair')" required />
          <SearchableDropdown v-model="form.tailor_id" :options="tailors" :label="t('repairDeposits.tailor')" :placeholder="t('repairDeposits.selectTailor')" required :disabled="!!form.repair_id" />
        </div>

        <div v-if="repairInfo" class="p-3 bg-surface-50 border border-surface-200 rounded-lg text-sm">
          <div class="grid grid-cols-2 gap-2">
            <div><span class="text-surface-500">{{ t('repairDeposits.brand') }}:</span> <span class="font-medium">{{ selectedRepair?.brand?.name || '-' }}</span></div>
            <div><span class="text-surface-500">{{ t('repairDeposits.article') }}:</span> <span class="font-medium">{{ selectedRepair?.article?.name || '-' }}</span></div>
            <div><span class="text-surface-500">{{ t('repairDeposits.sewingPrice') }}:</span> <span class="font-medium">{{ formatCurrency(selectedRepair?.sewing_price) }}</span></div>
            <div><span class="text-surface-500">{{ t('repairDeposits.remaining') }}:</span> <span class="font-medium">{{ repairInfo?.remaining || 0 }} / {{ repairInfo?.total_repair || 0 }} {{ t('common.pcs') }}</span></div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input v-model="form.total_deposit" :label="t('repairDeposits.totalDeposit')" type="number" placeholder="0" required />
          <Input v-model="form.deposit_date" :label="t('repairDeposits.depositDate')" type="date" required />
        </div>

        <div v-if="daysDelay > 0" class="p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm">
          <p class="text-amber-800">
            {{ t('repairDeposits.daysDelayHint', { days: daysDelay }) }}
          </p>
          <p class="text-amber-800 font-medium mt-1">
            {{ t('repairDeposits.charge') }}: {{ calculatedChargePercent }}% = {{ formatCurrency(calculatedCharge) }}
          </p>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showForm = false">{{ t('common.cancel') }}</Button>
          <Button :loading="submitting" @click="handleSubmit" :disabled="!form.repair_id || !form.total_deposit">{{ t('common.create') }}</Button>
        </div>
      </template>
    </Modal>

    <Modal v-model="showDeleteModal" :title="t('repairDeposits.deleteTitle')" size="sm" :closeOnOverlay="false">
      <p class="text-surface-700">{{ t('repairDeposits.deleteMessage') }}</p>
      <p class="text-sm text-surface-500 mt-1">{{ t('common.cannotUndo') }}</p>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showDeleteModal = false">{{ t('common.cancel') }}</Button>
          <Button variant="danger" @click="handleDelete">{{ t('common.delete') }}</Button>
        </div>
      </template>
    </Modal>
  </div>
</template>
