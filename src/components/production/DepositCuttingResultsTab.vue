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
const deposits = useMasterData('/deposit-cutting-results', () => ({ search: props.search, brand_filter: props.brandFilter }), false)
const { items, loading, fetchData } = deposits

function refresh() { fetchData(1) }
defineExpose({ refresh })

const columns = [
  { key: 'brand', label: 'Brand' },
  { key: 'name', label: 'Name' },
  { key: 'pre_order', label: 'Pre-Order' },
  { key: 'tailor', label: 'Tailor' },
  { key: 'article', label: 'Article' },
  { key: 'size', label: 'Size' },
  { key: 'total_sewing_result', label: 'Sewing Result' },
  { key: 'deposit_date', label: 'Deposit Date' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: '' },
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
        d.article?.name?.toLowerCase().includes(q) ||
        d.size?.abbreviation?.toLowerCase().includes(q) ||
        d.brand?.name?.toLowerCase().includes(q)
      )
    : available
  const map = new Map()
  for (const d of matches) {
    if (!map.has(d.name)) {
      map.set(d.name, { name: d.name, brand: d.brand, tailor: d.tailor, pre_order: d.cutting_result?.pre_order, entries: [] })
    }
    map.get(d.name).entries.push(d)
  }
  return Array.from(map.values())
})

async function fetchDistributionOptions() {
  try {
    const res = await request('/cutting-distributions?per_page=1000')
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

function selectDist(d) {
  form.value.cutting_distribution_id = d.id
  selectedDistribution.value = d
  showDistPicker.value = false
  distSearch.value = ''
  fetchDistRemaining(d.id)
}

async function fetchDistRemaining(distributionId) {
  try {
    const res = await request(`/cutting-distributions/remaining?cutting_distribution_id=${distributionId}`)
    distRemaining.value = res
  } catch { /* ignore */ }
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

const form = ref({ cutting_distribution_id: '', total_sewing_result: '', deposit_date: '', quality_notes: '', notes: '' })
const selectedDistribution = ref(null)

function openAddForm() {
  editing.value = null
  form.value = { cutting_distribution_id: '', total_sewing_result: '', deposit_date: '', quality_notes: '', notes: '' }
  formError.value = ''
  selectedDistribution.value = null
  distRemaining.value = null
  showDistPicker.value = false
  distSearch.value = ''
  fetchDistributionOptions()
  showForm.value = true
}

function openEditForm(item) {
  editing.value = item
  form.value = {
    cutting_distribution_id: item.cutting_distribution_id,
    total_sewing_result: String(item.total_sewing_result),
    deposit_date: item.deposit_date ? item.deposit_date.split('T')[0] : '',
    quality_notes: item.quality_notes || '',
    notes: item.notes || '',
  }
  formError.value = ''
  selectedDistribution.value = item.cutting_distribution
  showDistPicker.value = false
  distSearch.value = ''
  fetchDistributionOptions()
  showForm.value = true
}

async function handleSubmit() {
  formError.value = ''
  submitting.value = true
  try {
    const totalSewing = Number(form.value.total_sewing_result)
    if (distRemaining.value && totalSewing > distRemaining.value.available) {
      formError.value = `Sewing result (${totalSewing}) exceeds available distribution quantity (${distRemaining.value.available}).`
      submitting.value = false
      return
    }
    const payload = {
      cutting_distribution_id: form.value.cutting_distribution_id,
      total_sewing_result: totalSewing,
      deposit_date: form.value.deposit_date,
      quality_notes: form.value.quality_notes || null,
      notes: form.value.notes || null,
    }
    if (editing.value) {
      await request(`/deposit-cutting-results/${editing.value.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    } else {
      await request('/deposit-cutting-results', { method: 'POST', body: JSON.stringify(payload) })
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
      <Table v-else :columns="columns" :rows="items" :per-page="15">
        <template #name="{ value }"><span class="whitespace-nowrap min-w-50 inline-block">{{ value }}</span></template>
        <template #brand="{ value }"><Badge variant="primary" size="sm">{{ value?.name || '-' }}</Badge></template>
        <template #pre_order="{ row }"><span class="whitespace-nowrap min-w-40 inline-block">{{ row.cutting_distribution?.cutting_result?.pre_order?.name || '-' }}</span></template>
        <template #tailor="{ value }">{{ value?.name || '-' }}</template>
        <template #article="{ value }"><span class="whitespace-nowrap min-w-30 inline-block">{{ value?.name || '-' }}</span></template>
        <template #size="{ value }"><Badge variant="default" size="sm">{{ value?.abbreviation || '-' }}</Badge></template>
        <template #deposit_date="{ value }">{{ formatDate(value) }}</template>
        <template #status="{ value }"><Badge :variant="statusBadge(value)" size="sm">{{ value }}</Badge></template>
        <template #actions="{ row }">
          <div class="flex items-center gap-1">
            <button @click.stop="openEditForm(row)" class="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer" title="Edit">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
            </button>
            <button @click.stop="openDeleteModal(row)" class="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer" title="Delete">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            </button>
          </div>
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
            <span class="flex-1 truncate text-left" :class="selectedDistribution ? 'text-surface-800' : 'text-surface-400'">
              {{ selectedDistribution
                ? `${selectedDistribution.name} — ${selectedDistribution.tailor?.name || ''} (${selectedDistribution.article?.name || ''} ${selectedDistribution.size?.abbreviation || ''})`
                : 'Select a distribution'
              }}
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
                  <template v-for="group in distGroups" :key="group.name">
                    <div class="sticky top-0 px-3 py-1.5 bg-surface-50 border-b border-surface-200 text-xs font-semibold text-surface-500 flex items-center gap-1.5">
                      <Badge variant="primary" size="sm">{{ group.brand?.name || '-' }}</Badge>
                      <span>{{ group.name }}</span>
                      <span class="text-surface-400">—</span>
                      <span>{{ group.tailor?.name || '-' }}</span>
                    </div>
                    <div
                      v-for="d in group.entries"
                      :key="d.id"
                      class="flex items-center justify-between px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-primary-50"
                      :class="{ 'bg-primary-50 text-primary-700': form.cutting_distribution_id === d.id }"
                      @click="selectDist(d)"
                    >
                      <div class="flex items-center gap-3">
                        <Badge variant="default" size="sm">{{ d.size?.abbreviation || '-' }}</Badge>
                        <span class="text-surface-700">{{ d.article?.name || '-' }}</span>
                        <span class="text-xs text-surface-400">qty: {{ d.total_cutting }}</span>
                      </div>
                      <Badge :variant="(d.deposit_remaining ?? d.total_cutting) > 0 ? 'success' : 'danger'" size="sm">
                        left: {{ d.deposit_remaining ?? d.total_cutting }}
                      </Badge>
                    </div>
                  </template>
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
        <div v-if="selectedDistribution" class="p-3 bg-surface-50 rounded-lg space-y-1 text-sm">
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
