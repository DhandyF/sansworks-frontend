<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useApi } from '@/composables/useApi'
import { useMasterData } from '@/composables/useMasterData'
import { Button, Card, Table, Badge, Input, Modal } from 'ui-assets'

const props = defineProps({
  search: String,
  brandFilter: String,
})

const { request } = useApi()
const deposits = useMasterData('/deposit-cutting-results', () => ({ search: props.search, brand_filter: props.brandFilter }), { perPage: 1000000, autoFetch: false })
const { items, loading, fetchData } = deposits

function refresh() { fetchData(1) }
defineExpose({ refresh })

const groupedDeposits = computed(() => {
  const map = new Map()
  for (const item of items.value) {
    const distName = item.cutting_distribution?.name || item.name?.replace(/-DEP\d+$/, '') || '-'
    const key = `${distName}_${item.brand_id}_${item.tailor_id}`
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: distName,
        brand: item.brand,
        tailor: item.tailor,
        pre_order: item.cutting_distribution?.cutting_result?.pre_order,
        total_sewing_result: 0,
        total_price: 0,
        has_overdue: false,
        distIds: new Set(),
        entries: [],
      })
    }
    const group = map.get(key)
    group.entries.push(item)
    group.total_sewing_result += Number(item.total_sewing_result)
    group.total_price += Number(item.total_price || 0)
    if (item.status === 'overdue') group.has_overdue = true
    const distId = item.cutting_distribution_id
    if (distId && !group.distIds.has(distId)) {
      group.distIds.add(distId)
    }
  }
  const allDistsByGroup = new Map()
  for (const item of items.value) {
    const distName = item.cutting_distribution?.name || item.name?.replace(/-DEP\d+$/, '') || '-'
    const key = `${distName}_${item.brand_id}_${item.tailor_id}`
    if (!allDistsByGroup.has(key)) allDistsByGroup.set(key, new Map())
    const distId = item.cutting_distribution_id
    if (distId && !allDistsByGroup.get(key).has(distId)) {
      allDistsByGroup.get(key).set(distId, item.cutting_distribution)
    }
  }
  for (const group of map.values()) {
    let totalDistributed = 0
    let totalRemaining = 0
    const dists = allDistsByGroup.get(group.id)
    if (dists) {
      for (const dist of dists.values()) {
        totalDistributed += Number(dist.total_cutting || 0)
        totalRemaining += Number(dist.deposit_remaining ?? dist.total_cutting ?? 0)
      }
    }
    group.total_distributed = totalDistributed
    group.total_deposit_remaining = totalRemaining
  }
  return Array.from(map.values())
})

function groupStatus(group) {
  if (group.total_deposit_remaining <= 0) return 'done'
  if (group.has_overdue) return 'overdue'
  return 'in_progress'
}

const columns = [
  { key: 'brand', label: 'Brand' },
  { key: 'name', label: 'Distribution' },
  { key: 'tailor', label: 'Tailor' },
  { key: 'total_sewing_result', label: 'Total Sewing' },
  { key: 'total_price', label: 'Total Price' },
  { key: 'total_deposit_remaining', label: 'Remaining' },
  { key: 'status', label: 'Status' },
]

const allDistributions = ref([])
const showDistPicker = ref(false)
const distSearch = ref('')
const distPickerRef = ref(null)
const distTriggerRef = ref(null)
const distDropdownRef = ref(null)

const distGroups = computed(() => {
  const available = allDistributions.value.filter(d => (d.deposit_remaining ?? d.total_cutting) > 0)
  const q = distSearch.value.toLowerCase()
  const matches = q
    ? available.filter(d =>
        d.name?.toLowerCase().includes(q) ||
        d.tailor?.name?.toLowerCase().includes(q) ||
        d.brand?.name?.toLowerCase().includes(q) ||
        d.cutting_result?.pre_order?.name?.toLowerCase().includes(q)
      )
    : available

  const map = new Map()
  for (const d of matches) {
    const key = d.name
    if (!map.has(key)) {
      map.set(key, {
        name: d.name,
        brand: d.brand,
        tailor: d.tailor,
        pre_order: d.cutting_result?.pre_order,
        entries: [],
        total_distributed: 0,
        total_remaining: 0,
      })
    }
    const group = map.get(key)
    group.entries.push(d)
    group.total_distributed += Number(d.total_cutting)
    group.total_remaining += Number(d.deposit_remaining ?? d.total_cutting)
  }
  return Array.from(map.values())
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

function selectDistGroup(group) {
  form.value.cutting_distribution_ids = group.entries.map(e => e.id)
  form.value.total_sewing_result = String(group.total_remaining)
  selectedDistGroup.value = group
  showDistPicker.value = false
  distSearch.value = ''
  distRemaining.value = {
    total_cutting: group.total_distributed,
    deposited: group.total_distributed - group.total_remaining,
    available: group.total_remaining,
  }
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

const form = ref({ cutting_distribution_ids: [], cutting_distribution_id: '', total_sewing_result: '', cutting_price_per_pcs: '', deposit_date: '', quality_notes: '', notes: '' })
const selectedDistGroup = ref(null)
const selectedDistribution = ref(null)

const computedTotalPrice = computed(() => {
  const price = Number(form.value.cutting_price_per_pcs) || 0
  const qty = Number(form.value.total_sewing_result) || 0
  return price * qty
})

function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(value)
}

function openAddForm() {
  editing.value = null
  form.value = { cutting_distribution_ids: [], cutting_distribution_id: '', total_sewing_result: '', cutting_price_per_pcs: '', deposit_date: '', quality_notes: '', notes: '' }
  formError.value = ''
  selectedDistGroup.value = null
  distRemaining.value = null
  showDistPicker.value = false
  distSearch.value = ''
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
        formError.value = `Sewing result (${totalSewing}) exceeds available distribution quantity (${distRemaining.value.available}).`
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
      }
      await request(`/deposit-cutting-results/${editing.value.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    } else {
      const totalSewing = Number(form.value.total_sewing_result)
      if (distRemaining.value && totalSewing > distRemaining.value.available) {
        formError.value = `Sewing result (${totalSewing}) exceeds available quantity (${distRemaining.value.available}).`
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
      <Button @click="openAddForm">+ Add Deposit</Button>
    </div>
    <Card variant="bordered">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      <div v-else-if="items.length === 0" class="text-center py-12">
        <p class="text-surface-500">No deposits found</p>
      </div>
      <Table v-else :columns="columns" :rows="groupedDeposits" expandable :per-page="15">
        <template #name="{ value }"><span class="whitespace-nowrap min-w-[200px] inline-block">{{ value }}</span></template>
        <template #brand="{ value }"><Badge variant="primary" size="sm">{{ value?.name || '-' }}</Badge></template>
        <template #tailor="{ value }">{{ value?.name || '-' }}</template>
        <template #total_sewing_result="{ value }"><span class="font-medium">{{ value }}</span></template>
        <template #total_price="{ value }"><span class="font-medium whitespace-nowrap">{{ formatCurrency(value) }}</span></template>
        <template #total_deposit_remaining="{ value }"><Badge :variant="value > 0 ? 'success' : 'danger'" size="sm">{{ value }}</Badge></template>
        <template #status="{ row }">
          <Badge :variant="statusBadge(groupStatus(row))" size="sm">{{ groupStatus(row) }}</Badge>
        </template>
        <template #expanded="{ row }">
          <Card variant="bordered" class="shadow-none!">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-surface-200">
                  <th class="py-1.5 px-3 text-left font-medium text-surface-500">Deposit Name</th>
                  <th class="py-1.5 px-3 text-left font-medium text-surface-500">Article</th>
                  <th class="py-1.5 px-3 text-left font-medium text-surface-500">Size</th>
                  <th class="py-1.5 px-3 text-right font-medium text-surface-500">Sewing Result</th>
                  <th class="py-1.5 px-3 text-right font-medium text-surface-500">Price/Pcs</th>
                  <th class="py-1.5 px-3 text-right font-medium text-surface-500">Total Price</th>
                  <th class="py-1.5 px-3 text-left font-medium text-surface-500">Deposit Date</th>
                  <th class="py-1.5 px-3 text-left font-medium text-surface-500">Status</th>
                  <th class="py-1.5 px-3 text-right font-medium text-surface-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in row.entries" :key="entry.id" class="border-b border-surface-100 last:border-0">
                  <td class="py-1.5 px-3 whitespace-nowrap">{{ entry.name }}</td>
                  <td class="py-1.5 px-3">{{ entry.article?.name || '-' }}</td>
                  <td class="py-1.5 px-3"><Badge variant="default" size="sm">{{ entry.size?.abbreviation || '-' }}</Badge></td>
                  <td class="py-1.5 px-3 text-right">{{ entry.total_sewing_result }}</td>
                  <td class="py-1.5 px-3 text-right">{{ formatCurrency(entry.cutting_price_per_pcs) }}</td>
                  <td class="py-1.5 px-3 text-right font-medium">{{ formatCurrency(entry.total_price) }}</td>
                  <td class="py-1.5 px-3">{{ formatDate(entry.deposit_date) }}</td>
                  <td class="py-1.5 px-3"><Badge :variant="statusBadge(entry.status)" size="sm">{{ entry.status }}</Badge></td>
                  <td class="py-1.5 px-3 text-right">
                    <button @click="openEditForm(entry)" class="p-1 rounded-lg text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer" title="Edit">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                    </button>
                    <button @click="openDeleteModal(entry)" class="p-1 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer" title="Delete">
                      <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        </template>
      </Table>
    </Card>

    <Modal v-model="showForm" :title="editing ? 'Edit Deposit' : 'Add Deposit'" size="lg" :closeOnOverlay="false" contentClass="h-[80vh]">
      <div class="space-y-4">
        <div v-if="formError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{{ formError }}</div>
        <div class="relative" ref="distPickerRef" v-if="!editing">
          <label class="block text-sm font-medium text-surface-700 mb-1">Distribution <span class="text-danger">*</span></label>
          <button
            ref="distTriggerRef"
            type="button"
            class="inline-flex items-center gap-2 w-full px-4 py-2 text-sm font-medium bg-white border rounded-lg transition-colors hover:bg-surface-50 cursor-pointer"
            :class="showDistPicker ? 'border-primary-500 ring-2 ring-primary-500/30' : 'border-surface-300'"
            @click="toggleDistPicker"
          >
            <span class="flex-1 truncate text-left" :class="selectedDistGroup ? 'text-surface-800' : 'text-surface-400'">
              {{ selectedDistGroup ? `${selectedDistGroup.name} — ${selectedDistGroup.tailor?.name || ''}` : 'Select a distribution group' }}
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
                    <input v-model="distSearch" class="w-full bg-transparent outline-none text-sm placeholder:text-surface-400" placeholder="Search distributions..." />
                  </div>
                </div>
                <div v-if="distGroups.length === 0" class="px-4 py-3 text-sm text-surface-400 text-center">No available distributions</div>
                <div v-else class="max-h-72 overflow-y-auto">
                  <div
                    v-for="group in distGroups"
                    :key="group.name"
                    class="px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-primary-50"
                    :class="{ 'bg-primary-50 text-primary-700': selectedDistGroup?.name === group.name }"
                    @click="selectDistGroup(group)"
                  >
                    <div class="flex items-center justify-between">
                      <div class="flex items-center gap-2">
                        <Badge variant="primary" size="sm">{{ group.brand?.name || '-' }}</Badge>
                        <span class="font-medium text-surface-800">{{ group.name }}</span>
                        <span class="text-surface-400">—</span>
                        <span>{{ group.tailor?.name || '-' }}</span>
                      </div>
                      <Badge :variant="group.total_remaining > 0 ? 'success' : 'danger'" size="sm">rem: {{ group.total_remaining }}</Badge>
                    </div>
                    <div class="mt-1 flex flex-wrap gap-1">
                      <Badge v-for="d in group.entries" :key="d.id" variant="default" size="sm">{{ d.size?.abbreviation || '-' }}: {{ d.deposit_remaining ?? d.total_cutting }}</Badge>
                    </div>
                  </div>
                </div>
              </div>
            </Transition>
          </Teleport>
        </div>
        <div v-else>
          <label class="block text-sm font-medium text-surface-700 mb-1">Distribution</label>
          <div class="px-4 py-2 text-sm bg-surface-50 border border-surface-200 rounded-lg text-surface-700">
            {{ selectedDistribution?.name || '-' }} — {{ selectedDistribution?.tailor?.name || '' }}
          </div>
        </div>
        <div v-if="!editing && selectedDistGroup" class="p-3 bg-surface-50 rounded-lg space-y-1 text-sm">
          <p><span class="font-medium">Brand:</span> {{ selectedDistGroup.brand?.name || '-' }}</p>
          <p><span class="font-medium">Tailor:</span> {{ selectedDistGroup.tailor?.name || '-' }}</p>
          <p><span class="font-medium">Total Distributed:</span> {{ selectedDistGroup.total_distributed }}</p>
          <p><span class="font-medium">Total Remaining:</span> <span :class="selectedDistGroup.total_remaining > 0 ? 'text-green-600' : 'text-red-600'" class="font-medium">{{ selectedDistGroup.total_remaining }}</span></p>
        </div>
        <div v-if="editing && selectedDistribution" class="p-3 bg-surface-50 rounded-lg space-y-1 text-sm">
          <p><span class="font-medium">Pre-Order:</span> {{ selectedDistribution.cutting_result?.pre_order?.name || selectedDistribution.cutting_result?.name || '-' }}</p>
          <p><span class="font-medium">Tailor:</span> {{ selectedDistribution.tailor?.name || '-' }}</p>
          <p><span class="font-medium">Brand:</span> {{ selectedDistribution.brand?.name || '-' }}</p>
          <p><span class="font-medium">Article:</span> {{ selectedDistribution.article?.name || '-' }}</p>
          <p><span class="font-medium">Size:</span> {{ selectedDistribution.size?.abbreviation || '-' }}</p>
          <p><span class="font-medium">Distributed:</span> {{ selectedDistribution.total_cutting || '-' }}</p>
        </div>
        <div v-if="distRemaining" class="p-3 bg-blue-50 rounded-lg space-y-1 text-sm">
          <p><span class="font-medium">Total Distributed:</span> {{ distRemaining.total_cutting }}</p>
          <p><span class="font-medium">Already Deposited:</span> {{ distRemaining.deposited }}</p>
          <p><span class="font-medium">Available:</span> <span :class="distRemaining.available > 0 ? 'text-green-600' : 'text-red-600'" class="font-medium">{{ distRemaining.available }}</span></p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input v-model="form.total_sewing_result" label="Sewing Result" type="number" placeholder="0" required />
          <Input v-model="form.cutting_price_per_pcs" label="Cutting Price/Pcs" type="number" placeholder="0" required />
        </div>
        <div class="px-4 py-2 bg-surface-50 border border-surface-200 rounded-lg text-sm">
          <span class="font-medium text-surface-600">Total Price:</span>
          <span class="ml-2 font-semibold">{{ formatCurrency(computedTotalPrice) }}</span>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input v-model="form.deposit_date" label="Deposit Date" type="date" required />
        </div>
        <Input v-model="form.quality_notes" label="Quality Notes" type="textarea" placeholder="Optional quality notes" />
        <Input v-model="form.notes" label="Notes" type="textarea" placeholder="Optional notes" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showForm = false">Cancel</Button>
          <Button :loading="submitting" @click="handleSubmit">{{ editing ? 'Update' : 'Create' }}</Button>
        </div>
      </template>
    </Modal>

    <Modal v-model="showDeleteModal" title="Delete Deposit" size="sm" :closeOnOverlay="false">
      <p class="text-surface-700">Are you sure you want to delete <strong>{{ deletingItem?.name }}</strong>? This action cannot be undone.</p>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showDeleteModal = false">Cancel</Button>
          <Button variant="danger" @click="handleDelete">Delete</Button>
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
