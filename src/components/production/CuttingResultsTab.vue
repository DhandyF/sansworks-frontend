<script setup>
import { ref, computed, watch } from 'vue'
import { useApi } from '@/composables/useApi'
import { useMasterData } from '@/composables/useMasterData'
import { Button, Card, Table, Badge, Input, Modal, SearchableDropdown } from 'ui-assets'

const props = defineProps({
  search: String,
  brandFilter: String,
})

const { request } = useApi()
const cuttingResults = useMasterData('/cutting-results', () => ({ search: props.search, brand_filter: props.brandFilter }))
const { items, loading, fetchData } = cuttingResults

function refresh() { fetchData(1) }
defineExpose({ refresh })

const groupedResults = computed(() => {
  const map = new Map()
  for (const item of items.value) {
    const key = item.name
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: item.name,
        brand: item.brand,
        pre_order: item.pre_order,
        total_cutting: 0,
        remaining: 0,
        entries: [],
        rawIds: [],
      })
    }
    const group = map.get(key)
    group.entries.push(item)
    group.total_cutting += Number(item.total_cutting)
    group.remaining += Number(item.remaining)
    group.rawIds.push(item.id)
  }
  return Array.from(map.values())
})

const columns = [
  { key: 'brand', label: 'Brand' },
  { key: 'name', label: 'Name' },
  { key: 'pre_order', label: 'Pre-Order' },
  { key: 'total_cutting', label: 'Total Cutting' },
  { key: 'remaining', label: 'Remaining' },
]

const brands = ref([])
const preOrders = ref([])
const allPreOrderRows = ref([])
const preOrderArticles = ref([])
const preOrderSizes = ref([])

async function fetchOptions() {
  if (brands.value.length) return
  try {
    const res = await request('/brands?per_page=1000')
    brands.value = res.data.map(b => ({ value: b.id, label: b.name }))
  } catch { /* ignore */ }
}

async function fetchPreOrders(brandId) {
  preOrders.value = []
  allPreOrderRows.value = []
  preOrderArticles.value = []
  preOrderSizes.value = []
  if (!brandId) return
  try {
    const res = await request(`/pre-orders?brand_filter=${brandId}&per_page=1000`)
    allPreOrderRows.value = res.data
    const seen = new Set()
    for (const po of res.data) {
      if (!seen.has(po.name)) {
        seen.add(po.name)
        preOrders.value.push({ value: po.name, label: po.name })
      }
    }
  } catch { /* ignore */ }
}

function onPreOrderSelect(poName) {
  preOrderArticles.value = []
  preOrderSizes.value = []
  const rows = allPreOrderRows.value.filter(p => p.name === poName)
  if (!rows.length) return
  const articleMap = new Map()
  for (const row of rows) {
    if (row.article && !articleMap.has(row.article_id)) {
      articleMap.set(row.article_id, { value: row.article_id, label: row.article.name })
    }
  }
  preOrderArticles.value = Array.from(articleMap.values())
}

function onArticleSelect(articleId) {
  preOrderSizes.value = []
  const poName = form.value.pre_order_name
  const rows = allPreOrderRows.value.filter(p => p.name === poName && p.article_id === articleId)
  const sizeMap = new Map()
  for (const row of rows) {
    if (row.size && !sizeMap.has(row.size_id)) {
      sizeMap.set(row.size_id, { value: row.size_id, label: row.size.abbreviation, poData: row })
    }
  }
  preOrderSizes.value = Array.from(sizeMap.values())
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Form
const showForm = ref(false)
const editing = ref(null)
const formError = ref('')
const submitting = ref(false)
const sizeRemaining = ref(null)

const form = ref({ brand_id: '', pre_order_name: '', article_id: '', size_id: '', total_cutting: '', cutting_date: '', notes: '' })
const formSteps = computed(() => ({ showArticle: !!form.value.pre_order_name, showSize: !!form.value.article_id }))

function openAddForm() {
  editing.value = null
  form.value = { brand_id: '', pre_order_name: '', article_id: '', size_id: '', total_cutting: '', cutting_date: '', notes: '' }
  formError.value = ''
  preOrderArticles.value = []
  preOrderSizes.value = []
  sizeRemaining.value = null
  fetchOptions()
  showForm.value = true
}

function openEditForm(item) {
  editing.value = item
  form.value = {
    brand_id: item.brand_id,
    pre_order_name: item.pre_order?.name || '',
    article_id: item.article_id,
    size_id: item.size_id,
    total_cutting: String(item.total_cutting),
    cutting_date: item.cutting_date ? item.cutting_date.split('T')[0] : '',
    notes: item.notes || '',
  }
  formError.value = ''
  sizeRemaining.value = null
  fetchOptions()
  fetchPreOrders(item.brand_id).then(() => {
    onPreOrderSelect(item.pre_order?.name)
    onArticleSelect(item.article_id)
  })
  showForm.value = true
}

watch(() => form.value.brand_id, (val) => {
  form.value.pre_order_name = ''
  form.value.article_id = ''
  form.value.size_id = ''
  preOrderArticles.value = []
  preOrderSizes.value = []
  sizeRemaining.value = null
  fetchPreOrders(val)
})

watch(() => form.value.pre_order_name, (val) => {
  form.value.article_id = ''
  form.value.size_id = ''
  sizeRemaining.value = null
  onPreOrderSelect(val)
})

watch(() => form.value.article_id, (val) => {
  form.value.size_id = ''
  sizeRemaining.value = null
  onArticleSelect(val)
})

watch(() => form.value.size_id, async (val) => {
  sizeRemaining.value = null
  if (!val) return
  const selectedSize = preOrderSizes.value.find(s => s.value === val)
  if (!selectedSize?.poData?.id) return
  try {
    const res = await request(`/cutting-results/remaining?pre_order_id=${selectedSize.poData.id}`)
    sizeRemaining.value = res
  } catch { /* ignore */ }
})

async function handleSubmit() {
  formError.value = ''
  submitting.value = true
  try {
    const selectedSize = preOrderSizes.value.find(s => s.value === form.value.size_id)
    const preOrderId = selectedSize?.poData?.id
    if (!preOrderId) {
      formError.value = 'Please select a valid pre-order, article, and size combination.'
      submitting.value = false
      return
    }
    const totalCutting = Number(form.value.total_cutting)
    if (sizeRemaining.value && totalCutting > sizeRemaining.value.available) {
      formError.value = `Total cutting (${totalCutting}) exceeds available quantity (${sizeRemaining.value.available}) for this pre-order item.`
      submitting.value = false
      return
    }
    const payload = {
      pre_order_id: preOrderId,
      article_id: form.value.article_id,
      size_id: form.value.size_id,
      total_cutting: totalCutting,
      cutting_date: form.value.cutting_date,
      notes: form.value.notes || null,
    }
    if (editing.value) {
      await request(`/cutting-results/${editing.value.id}`, { method: 'PUT', body: JSON.stringify(payload) })
    } else {
      await request('/cutting-results', { method: 'POST', body: JSON.stringify(payload) })
    }
    fetchData(1)
    showForm.value = false
  } catch (e) {
    formError.value = e.message
  } finally {
    submitting.value = false
  }
}

// Delete
const showDeleteModal = ref(false)
const deletingItem = ref(null)

function openDeleteModal(item) { deletingItem.value = item; showDeleteModal.value = true }

async function handleDelete() {
  if (!deletingItem.value) return
  try { await request(`/cutting-results/${deletingItem.value.id}`, { method: 'DELETE' }) } catch { /* ignore */ }
  showDeleteModal.value = false
  fetchData(1)
  deletingItem.value = null
}
</script>

<template>
  <div>
    <div class="flex justify-end mb-4">
      <Button @click="openAddForm">+ Add Cutting Result</Button>
    </div>
    <Card variant="bordered">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      <div v-else-if="items.length === 0" class="text-center py-12">
        <p class="text-surface-500">No cutting results found</p>
      </div>
      <Table v-else :columns="columns" :rows="groupedResults" expandable :per-page="15">
        <template #name="{ value }"><span class="block max-w-32 sm:max-w-48 lg:max-w-64 truncate" :title="value">{{ value }}</span></template>
        <template #brand="{ value }"><Badge variant="primary" size="sm">{{ value?.name || '-' }}</Badge></template>
        <template #pre_order="{ value }">{{ value?.name || '-' }}</template>
        <template #remaining="{ value }"><Badge :variant="value > 0 ? 'success' : 'danger'" size="sm">{{ value }}</Badge></template>
        <template #expanded="{ row }">
          <table class="w-full text-sm">
            <thead>
              <tr class="border-b border-surface-200">
                <th class="py-1.5 px-3 text-left font-medium text-surface-500">Article</th>
                <th class="py-1.5 px-3 text-left font-medium text-surface-500">Size</th>
                <th class="py-1.5 px-3 text-right font-medium text-surface-500">Total Cutting</th>
                <th class="py-1.5 px-3 text-right font-medium text-surface-500">Remaining</th>
                <th class="py-1.5 px-3 text-left font-medium text-surface-500">Cutting Date</th>
                <th class="py-1.5 px-3 text-right font-medium text-surface-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="entry in row.entries" :key="entry.id" class="border-b border-surface-100 last:border-0">
                <td class="py-1.5 px-3">{{ entry.article?.name || '-' }}</td>
                <td class="py-1.5 px-3"><Badge variant="default" size="sm">{{ entry.size?.abbreviation || '-' }}</Badge></td>
                <td class="py-1.5 px-3 text-right">{{ entry.total_cutting }}</td>
                <td class="py-1.5 px-3 text-right"><Badge :variant="entry.remaining > 0 ? 'success' : 'danger'" size="sm">{{ entry.remaining }}</Badge></td>
                <td class="py-1.5 px-3">{{ formatDate(entry.cutting_date) }}</td>
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
        </template>
      </Table>
    </Card>

    <Modal v-model="showForm" :title="editing ? 'Edit Cutting Result' : 'Add Cutting Result'" size="lg" :closeOnOverlay="false">
      <div class="space-y-4">
        <div v-if="formError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{{ formError }}</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchableDropdown v-model="form.brand_id" :options="brands" label="Brand" placeholder="Select a brand" required />
          <SearchableDropdown v-model="form.pre_order_name" :options="preOrders" label="Pre-Order" placeholder="Select a brand first" :disabled="!form.brand_id" required />
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchableDropdown v-if="formSteps.showArticle" v-model="form.article_id" :options="preOrderArticles" label="Article" placeholder="Select an article" required />
          <div v-else class="flex items-end"><p class="text-sm text-surface-400 pb-2">Select a pre-order first</p></div>
          <SearchableDropdown v-if="formSteps.showSize" v-model="form.size_id" :options="preOrderSizes" label="Size" placeholder="Select a size" required />
          <div v-else class="flex items-end"><p class="text-sm text-surface-400 pb-2">Select an article first</p></div>
        </div>
        <div v-if="sizeRemaining" class="p-3 bg-surface-50 rounded-lg space-y-1 text-sm">
          <p><span class="font-medium">Pre-Order Qty:</span> {{ sizeRemaining.total_pcs }}</p>
          <p><span class="font-medium">Already Cut:</span> {{ sizeRemaining.cut_qty }}</p>
          <p><span class="font-medium">Available:</span> <span :class="sizeRemaining.available > 0 ? 'text-green-600' : 'text-red-600'" class="font-medium">{{ sizeRemaining.available }}</span></p>
        </div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input v-model="form.total_cutting" label="Total Cutting" type="number" placeholder="0" required />
          <Input v-model="form.cutting_date" label="Cutting Date" type="date" required />
        </div>
        <Input v-model="form.notes" label="Notes" type="textarea" placeholder="Optional notes" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showForm = false">Cancel</Button>
          <Button :loading="submitting" @click="handleSubmit">{{ editing ? 'Update' : 'Create' }}</Button>
        </div>
      </template>
    </Modal>

    <Modal v-model="showDeleteModal" title="Delete Cutting Result" size="sm" :closeOnOverlay="false">
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
