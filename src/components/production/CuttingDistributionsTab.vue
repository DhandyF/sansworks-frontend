<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useApi } from '@/composables/useApi'
import { useMasterData } from '@/composables/useMasterData'
import { Button, Card, Table, Badge, Input, Modal, SearchableDropdown } from 'ui-assets'

const props = defineProps({
  search: String,
  brandFilter: String,
})

const { request } = useApi()
const distributions = useMasterData('/cutting-distributions', () => ({ search: props.search, brand_filter: props.brandFilter }), { perPage: 1000, autoFetch: false })
const { items, loading, fetchData } = distributions

function refresh() { fetchData(1) }
defineExpose({ refresh })

const groupedDistributions = computed(() => {
  const map = new Map()
  for (const item of items.value) {
    const key = `${item.name}_${item.brand_id}_${item.tailor_id}`
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: item.name,
        brand: item.brand,
        tailor: item.tailor,
        total_distributed: 0,
        total_deposit_remaining: 0,
        entries: [],
      })
    }
    const group = map.get(key)
    group.entries.push(item)
    group.total_distributed += Number(item.total_cutting)
    group.total_deposit_remaining += Number(item.deposit_remaining ?? item.total_cutting)
  }
  return Array.from(map.values())
})

const columns = [
  { key: 'brand', label: 'Brand' },
  { key: 'name', label: 'Name' },
  { key: 'tailor', label: 'Tailor' },
  { key: 'total_distributed', label: 'Total Distributed' },
  { key: 'total_deposit_remaining', label: 'Remaining' },
]

const tailors = ref([])
const allCuttingResults = ref([])
const showCrPicker = ref(false)
const crSearch = ref('')
const crPickerRef = ref(null)
const crTriggerRef = ref(null)
const crDropdownRef = ref(null)

const crGroups = computed(() => {
  const grouped = new Map()
  for (const cr of allCuttingResults.value) {
    if (!grouped.has(cr.name)) {
      const totalRemaining = allCuttingResults.value
        .filter(c => c.name === cr.name)
        .reduce((sum, c) => sum + Number(c.remaining ?? 0), 0)
      grouped.set(cr.name, {
        name: cr.name,
        brand: cr.brand,
        pre_order: cr.pre_order,
        total_remaining: totalRemaining,
        entries: [],
      })
    }
    grouped.get(cr.name).entries.push(cr)
  }
  const filtered = Array.from(grouped.values()).filter(g => g.total_remaining > 0)
  const q = crSearch.value.toLowerCase()
  if (!q) return filtered
  return filtered.filter(g =>
    g.name?.toLowerCase().includes(q) ||
    g.brand?.name?.toLowerCase().includes(q) ||
    g.pre_order?.name?.toLowerCase().includes(q)
  )
})

async function fetchOptions() {
  if (tailors.value.length) return
  try {
    const res = await request('/tailors?per_page=1000')
    tailors.value = res.data.map(t => ({ value: t.id, label: t.name }))
  } catch { /* ignore */ }
}

async function fetchCuttingResultsOptions() {
  try {
    const res = await request('/cutting-results?per_page=1000')
    allCuttingResults.value = res.data
  } catch { /* ignore */ }
}

function toggleCrPicker() {
  showCrPicker.value = !showCrPicker.value
  if (showCrPicker.value) {
    crSearch.value = ''
    nextTick(() => {
      const input = crDropdownRef.value?.querySelector('input')
      input?.focus()
    })
  }
}

function selectCrGroup(group) {
  form.value.cutting_result_name = group.name
  form.value.total_cutting = String(group.total_remaining)
  selectedCrGroup.value = group
  showCrPicker.value = false
  crSearch.value = ''
}

function handleCrClickOutside(e) {
  if (crPickerRef.value?.contains(e.target)) return
  if (crDropdownRef.value?.contains(e.target)) return
  showCrPicker.value = false
}

onMounted(() => document.addEventListener('click', handleCrClickOutside, true))
onUnmounted(() => document.removeEventListener('click', handleCrClickOutside, true))

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const showForm = ref(false)
const editing = ref(null)
const formError = ref('')
const submitting = ref(false)

const form = ref({ cutting_result_name: '', tailor_id: '', total_cutting: '', taken_date: '', deadline_date: '', notes: '' })
const selectedCrGroup = ref(null)

function openAddForm() {
  editing.value = null
  form.value = { cutting_result_name: '', tailor_id: '', total_cutting: '', taken_date: '', deadline_date: '', notes: '' }
  formError.value = ''
  selectedCrGroup.value = null
  showCrPicker.value = false
  crSearch.value = ''
  fetchOptions()
  fetchCuttingResultsOptions()
  showForm.value = true
}

function openEditForm(item) {
  editing.value = item
  form.value = {
    cutting_result_id: item.cutting_result_id,
    tailor_id: item.tailor_id,
    total_cutting: String(item.total_cutting),
    taken_date: item.taken_date ? item.taken_date.split('T')[0] : '',
    deadline_date: item.deadline_date ? item.deadline_date.split('T')[0] : '',
    notes: item.notes || '',
  }
  formError.value = ''
  selectedCrGroup.value = {
    brand: item.brand,
    article: item.article,
    size: item.size,
    remaining: item.cutting_result?.remaining,
    total_cutting: item.cutting_result?.total_cutting,
  }
  showCrPicker.value = false
  crSearch.value = ''
  fetchOptions()
  fetchCuttingResultsOptions()
  showForm.value = true
}

async function handleSubmit() {
  formError.value = ''
  submitting.value = true
  try {
    if (editing.value) {
      const payload = {
        cutting_result_id: form.value.cutting_result_id,
        tailor_id: form.value.tailor_id,
        total_cutting: Number(form.value.total_cutting),
        taken_date: form.value.taken_date,
        deadline_date: form.value.deadline_date || null,
        notes: form.value.notes || null,
      }
      await request(`/cutting-distributions/${editing.value.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    } else {
      const payload = {
        cutting_result_name: form.value.cutting_result_name,
        tailor_id: form.value.tailor_id,
        total_cutting: Number(form.value.total_cutting),
        taken_date: form.value.taken_date,
        deadline_date: form.value.deadline_date || null,
        notes: form.value.notes || null,
      }
      await request('/cutting-distributions/batch', { method: 'POST', body: JSON.stringify(payload) })
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
  try { await request(`/cutting-distributions/${deletingItem.value.id}`, { method: 'DELETE' }) } catch { /* ignore */ }
  showDeleteModal.value = false
  fetchData(1)
  deletingItem.value = null
}

function positionCrPicker() {
  if (!crTriggerRef.value) return
  const rect = crTriggerRef.value.getBoundingClientRect()
  const dropdown = crDropdownRef.value
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
      <Button @click="openAddForm">+ Add Distribution</Button>
    </div>
    <Card variant="bordered">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      <div v-else-if="items.length === 0" class="text-center py-12">
        <p class="text-surface-500">No distributions found</p>
      </div>
      <Table v-else :columns="columns" :rows="groupedDistributions" expandable :per-page="15">
        <template #name="{ value }"><span class="whitespace-nowrap min-w-[200px] inline-block">{{ value }}</span></template>
        <template #brand="{ value }"><Badge variant="primary" size="sm">{{ value?.name || '-' }}</Badge></template>
        <template #tailor="{ value }">{{ value?.name || '-' }}</template>
        <template #total_deposit_remaining="{ value }"><Badge :variant="value > 0 ? 'success' : 'danger'" size="sm">{{ value }}</Badge></template>
        <template #expanded="{ row }">
          <Card variant="bordered" class="shadow-none!">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-surface-200">
                  <th class="py-1.5 px-3 text-left font-medium text-surface-500">Article</th>
                  <th class="py-1.5 px-3 text-left font-medium text-surface-500">Size</th>
                  <th class="py-1.5 px-3 text-right font-medium text-surface-500">Distributed</th>
                  <th class="py-1.5 px-3 text-right font-medium text-surface-500">Remaining</th>
                  <th class="py-1.5 px-3 text-left font-medium text-surface-500">Taken Date</th>
                  <th class="py-1.5 px-3 text-left font-medium text-surface-500">Deadline</th>
                  <th class="py-1.5 px-3 text-right font-medium text-surface-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="entry in row.entries" :key="entry.id" class="border-b border-surface-100 last:border-0">
                  <td class="py-1.5 px-3">{{ entry.article?.name || '-' }}</td>
                  <td class="py-1.5 px-3"><Badge variant="default" size="sm">{{ entry.size?.abbreviation || '-' }}</Badge></td>
                  <td class="py-1.5 px-3 text-right">{{ entry.total_cutting }}</td>
                  <td class="py-1.5 px-3 text-right"><Badge :variant="(entry.deposit_remaining ?? entry.total_cutting) > 0 ? 'success' : 'danger'" size="sm">{{ entry.deposit_remaining ?? entry.total_cutting }}</Badge></td>
                  <td class="py-1.5 px-3">{{ formatDate(entry.taken_date) }}</td>
                  <td class="py-1.5 px-3">{{ formatDate(entry.deadline_date) }}</td>
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

    <Modal v-model="showForm" :title="editing ? 'Edit Distribution' : 'Add Distribution'" size="lg" contentClass="h-[80vh]" :closeOnOverlay="false">
      <div class="space-y-4">
        <div v-if="formError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{{ formError }}</div>

        <template v-if="!editing">
          <div class="relative" ref="crPickerRef">
            <label class="block text-sm font-medium text-surface-700 mb-1">Cutting Result <span class="text-danger">*</span></label>
            <button
              ref="crTriggerRef"
              type="button"
              class="inline-flex items-center gap-2 w-full px-4 py-2 text-sm font-medium bg-white border rounded-lg transition-colors hover:bg-surface-50 cursor-pointer"
              :class="showCrPicker ? 'border-primary-500 ring-2 ring-primary-500/30' : 'border-surface-300'"
              @click="toggleCrPicker"
            >
              <span class="flex-1 truncate text-left" :class="selectedCrGroup ? 'text-surface-800' : 'text-surface-400'">
                {{ selectedCrGroup ? selectedCrGroup.name : 'Select a cutting result group' }}
              </span>
              <svg class="w-4 h-4 text-surface-500 transition-transform duration-150 shrink-0" :class="{ 'rotate-180': showCrPicker }" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/></svg>
            </button>
            <Teleport to="body">
              <Transition name="cr-picker" @before-enter="positionCrPicker" @enter="positionCrPicker">
                <div
                  v-if="showCrPicker"
                  ref="crDropdownRef"
                  class="fixed z-9999 bg-white border border-surface-200 rounded-xl shadow-lg overflow-hidden"
                >
                  <div class="border-b border-surface-200 p-2">
                    <div class="flex items-center gap-2 px-3 py-1.5 bg-surface-50 rounded-lg">
                      <svg class="w-4 h-4 text-surface-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                      <input v-model="crSearch" class="w-full bg-transparent outline-none text-sm placeholder:text-surface-400" placeholder="Search cutting results..." />
                    </div>
                  </div>
                  <div v-if="crGroups.length === 0" class="px-4 py-3 text-sm text-surface-400 text-center">No cutting results available</div>
                  <div v-else class="max-h-72 overflow-y-auto">
                    <div
                      v-for="group in crGroups"
                      :key="group.name"
                      class="px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-primary-50"
                      :class="{ 'bg-primary-50 text-primary-700': form.cutting_result_name === group.name }"
                      @click="selectCrGroup(group)"
                    >
                      <div class="flex items-center justify-between">
                        <div class="flex items-center gap-2">
                          <Badge variant="primary" size="sm">{{ group.brand?.name || '-' }}</Badge>
                          <span class="font-medium text-surface-800">{{ group.name }}</span>
                        </div>
                        <Badge :variant="group.total_remaining > 0 ? 'success' : 'danger'" size="sm">rem: {{ group.total_remaining }}</Badge>
                      </div>
                      <div class="mt-1 flex flex-wrap gap-1">
                        <Badge v-for="cr in group.entries" :key="cr.id" variant="default" size="sm">{{ cr.size?.abbreviation || '-' }}: {{ cr.remaining }}</Badge>
                      </div>
                    </div>
                  </div>
                </div>
              </Transition>
            </Teleport>
          </div>
          <div v-if="selectedCrGroup" class="p-3 bg-surface-50 rounded-lg space-y-1 text-sm">
            <p><span class="font-medium">Brand:</span> {{ selectedCrGroup.brand?.name || '-' }}</p>
            <p><span class="font-medium">Pre-Order:</span> {{ selectedCrGroup.pre_order?.name || '-' }}</p>
            <p><span class="font-medium">Total Remaining:</span> <span :class="selectedCrGroup.total_remaining > 0 ? 'text-green-600' : 'text-red-600'" class="font-medium">{{ selectedCrGroup.total_remaining }}</span></p>
          </div>
        </template>

        <template v-else>
          <div class="p-3 bg-surface-50 rounded-lg space-y-1 text-sm">
            <p><span class="font-medium">Brand:</span> {{ editing.brand?.name || '-' }}</p>
            <p><span class="font-medium">Article:</span> {{ editing.article?.name || '-' }}</p>
            <p><span class="font-medium">Size:</span> {{ editing.size?.abbreviation || '-' }}</p>
            <p><span class="font-medium">Remaining:</span> {{ selectedCrGroup?.remaining ?? '-' }}</p>
          </div>
        </template>

        <SearchableDropdown v-model="form.tailor_id" :options="tailors" label="Tailor" placeholder="Select a tailor" required />
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input v-model="form.total_cutting" label="Quantity to Distribute" type="number" placeholder="0" required />
          <Input v-model="form.taken_date" label="Taken Date" type="date" required />
        </div>
        <Input v-model="form.deadline_date" label="Deadline Date" type="date" />
        <Input v-model="form.notes" label="Notes" type="textarea" placeholder="Optional notes" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showForm = false">Cancel</Button>
          <Button :loading="submitting" @click="handleSubmit">{{ editing ? 'Update' : 'Create' }}</Button>
        </div>
      </template>
    </Modal>

    <Modal v-model="showDeleteModal" title="Delete Distribution" size="sm" :closeOnOverlay="false">
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
.cr-picker-enter-active { transition: all 0.15s ease-out; }
.cr-picker-leave-active { transition: all 0.1s ease-in; }
.cr-picker-enter-from, .cr-picker-leave-to { opacity: 0; transform: translateY(-4px); }
</style>
