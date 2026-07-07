<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMasterData } from '@/composables/useMasterData'
import { useApi } from '@/composables/useApi'
import { useDebounce } from '@/composables/useDebounce'
import { usePersistentFilters } from '@/composables/usePersistentFilters'
import { Button, Card, Table, Badge, Input, Modal, SearchableDropdown } from 'ui-assets'

const { t } = useI18n()

const { search, brandFilter } = usePersistentFilters('preorders-filters', {
  search: '',
  brandFilter: ''
})
const { debounce } = useDebounce(500)

const { items, loading, fetchData, deleteItem } = useMasterData('/pre-orders', () => ({ search: search.value, brand_filter: brandFilter.value }), { perPage: 1000000 })

watch([search, brandFilter], () => debounce(() => fetchData(1)))

const { request } = useApi()
const brands = ref([])
const sizes = ref([])
const articles = ref([])
const nextName = ref('')

const cuttingForm = ref(null)
const cuttingSubmitting = ref(false)
const cuttingError = ref('')
const cuttingFormStyle = ref({})

const cuttingDetailForm = ref(null)
const cuttingDetailSubmitting = ref(false)
const cuttingDetailError = ref('')
const editingCutting = ref(null)
const showCuttingDetailModal = ref(false)
const showCuttingDeleteModal = ref(false)
const deletingCuttingId = ref(null)
const deletingCuttingHasDistributions = ref(false)

const tooltipData = ref(null)
const tooltipStyle = ref({})
const today = new Date().toISOString().split('T')[0]

function showTooltip(entry, event) {
  if (!entry.cutting_results || entry.cutting_results.length === 0) return
  const rect = event.currentTarget.getBoundingClientRect()
  tooltipData.value = entry.cutting_results
  tooltipStyle.value = {
    top: `${rect.bottom + 6}px`,
    left: `${Math.max(8, rect.left - 40)}px`,
  }
}

function hideTooltip() {
  tooltipData.value = null
  tooltipStyle.value = {}
}

function openCuttingForm(entry, group, event) {
  cuttingForm.value = {
    pre_order_id: entry.id,
    brand_id: group.brand_id,
    article_id: group.articles.find(a => a.entries.some(e => e.id === entry.id))?.article_id || '',
    size_id: entry.size_id,
    total_pcs: entry.total_pcs,
    cut_qty: entry.cut_qty ?? 0,
    excess_cutting: entry.excess_cutting ?? 0,
    remaining: entry.remaining ?? entry.total_pcs,
    total_cutting: '',
    cutting_date: today,
  }
  cuttingError.value = ''
  nextTick(() => positionCuttingForm(event))
}

function positionCuttingForm(event) {
  const btnRect = event.currentTarget.getBoundingClientRect()
  cuttingFormStyle.value = {
    top: `${btnRect.bottom + 4}px`,
    left: `${Math.max(8, Math.min(btnRect.left, window.innerWidth - 288))}px`,
  }
  nextTick(() => {
    if (!cuttingFormRef.value) return
    const formRect = cuttingFormRef.value.getBoundingClientRect()
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
    cuttingFormStyle.value = {
      top: `${top}px`,
      left: `${Math.max(8, Math.min(btnRect.left, window.innerWidth - 288))}px`,
    }
  })
}

function closeCuttingForm() {
  cuttingForm.value = null
  cuttingSubmitting.value = false
  cuttingError.value = ''
  cuttingFormStyle.value = {}
}

function openCuttingDetailForm(entry) {
  cuttingDetailForm.value = {
    pre_order_id: entry.id,
    total_pcs: entry.total_pcs,
    cut_qty: entry.cut_qty ?? 0,
    excess_cutting: entry.excess_cutting ?? 0,
    remaining: entry.remaining ?? entry.total_pcs,
    cutting_results: [...(entry.cutting_results || [])],
  }
  cuttingDetailError.value = ''
  editingCutting.value = null
  showCuttingDetailModal.value = true
}

function closeCuttingDetailForm() {
  cuttingDetailForm.value = null
  cuttingDetailSubmitting.value = false
  cuttingDetailError.value = ''
  editingCutting.value = null
  showCuttingDetailModal.value = false
}

function startEditCutting(cutting) {
  editingCutting.value = {
    id: cutting.id,
    total_cutting: String(cutting.total_cutting),
    cutting_date: cutting.cutting_date,
  }
}

function cancelEditCutting() {
  editingCutting.value = null
}

async function updateCutting() {
  if (!editingCutting.value) return
  const f = editingCutting.value
  if (!f.total_cutting || Number(f.total_cutting) <= 0) {
    cuttingDetailError.value = t('preOrders.cuttingQtyGreater0')
    return
  }
  if (!f.cutting_date) {
    cuttingDetailError.value = t('preOrders.cuttingDateRequired')
    return
  }

  const otherCuttingsTotal = cuttingDetailForm.value?.cutting_results
    .filter(c => c.id !== f.id)
    .reduce((sum, c) => sum + c.total_cutting, 0) ?? 0

  const newTotalCut = otherCuttingsTotal + Number(f.total_cutting)
  let excess = 0

  // Calculate excess if cutting exceeds total_pcs
  if (newTotalCut > cuttingDetailForm.value.total_pcs) {
    excess = newTotalCut - cuttingDetailForm.value.total_pcs
    cuttingDetailError.value = `Warning: Total cutting exceeds total by ${excess} pcs`
  }

  cuttingDetailSubmitting.value = true
  cuttingDetailError.value = ''
  try {
    await request(`/cutting-results/${f.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        cutting_date: f.cutting_date,
        total_cutting: Number(f.total_cutting),
        excess_cutting: excess,
      }),
    })
    await fetchData(1)
    closeCuttingDetailForm()
  } catch (e) {
    cuttingDetailError.value = e.message
  } finally {
    cuttingDetailSubmitting.value = false
  }
}

async function deleteCutting(cutting) {
  const distributed = cutting.total_cutting - (cutting.excess_cutting || 0) - (cutting.remaining || 0)
  deletingCuttingHasDistributions.value = distributed > 0
  deletingCuttingId.value = cutting.id
  showCuttingDeleteModal.value = true
}

async function confirmDeleteCutting() {
  if (!deletingCuttingId.value) return
  try {
    await request(`/cutting-results/${deletingCuttingId.value}`, { method: 'DELETE' })
    await fetchData(1)
    closeCuttingDetailForm()
    showCuttingDeleteModal.value = false
  } catch { /* ignore */ }
}

function closeCuttingDeleteModal() {
  showCuttingDeleteModal.value = false
  deletingCuttingId.value = null
  deletingCuttingHasDistributions.value = false
}

async function submitCuttingResult() {
  if (!cuttingForm.value) return
  const f = cuttingForm.value
  if (!f.total_cutting || Number(f.total_cutting) <= 0) {
    cuttingError.value = t('preOrders.cuttingQtyGreater0')
    return
  }
  if (Number(f.total_cutting) > f.remaining) {
    // Allow excess cutting, just show a warning note
    cuttingError.value = `Warning: Cutting exceeds remaining by ${Number(f.total_cutting) - f.remaining} pcs`
  }
  if (!f.cutting_date) {
    cuttingError.value = t('preOrders.cuttingQtyRequired')
    return
  }
  cuttingSubmitting.value = true
  cuttingError.value = ''
  try {
    const qty = Number(f.total_cutting)
    let excess = 0

    // Calculate excess if cutting exceeds remaining
    if (qty > f.remaining) {
      excess = qty - f.remaining
    }

    const res = await request('/cutting-results', {
      method: 'POST',
      body: JSON.stringify({
        pre_order_id: f.pre_order_id,
        article_id: f.article_id,
        size_id: f.size_id,
        total_cutting: qty,
        excess_cutting: excess,
        cutting_date: f.cutting_date,
      }),
    })

    const item = items.value.find(i => i.id === f.pre_order_id)
    if (item) {
      item.cut_qty = (item.cut_qty ?? 0) + qty
      item.excess_cutting = (item.excess_cutting ?? 0) + excess
      item.remaining = Math.max(0, (item.remaining ?? item.total_pcs) - qty)
      if (!item.cutting_results) item.cutting_results = []
      item.cutting_results.push({
        id: res.id,
        total_cutting: qty,
        excess_cutting: excess,
        cutting_date: f.cutting_date,
      })
    }
    closeCuttingForm()
  } catch (e) {
    cuttingError.value = e.message
  } finally {
    cuttingSubmitting.value = false
  }
}

const cuttingFormRef = ref(null)

function handleCuttingFormClickOutside() {
}

onUnmounted(() => {
  document.removeEventListener('click', handleCuttingFormClickOutside, true)
})
let filterBrandsLoaded = false
const filterBrands = ref([])

onMounted(async () => {
  document.addEventListener('click', handleCuttingFormClickOutside, true)
  if (!filterBrandsLoaded) {
    try {
      const res = await request('/brands?per_page=1000000')
      filterBrands.value = res.data.map(b => ({ value: b.id, label: b.name }))
      filterBrandsLoaded = true
    } catch { /* ignore */ }
  }
})

async function fetchOptions() {
  if (brands.value.length) return
  try {
    const [brandsRes, sizesRes] = await Promise.all([
      request('/brands?per_page=1000000'),
      request('/sizes?per_page=1000000'),
    ])
    brands.value = brandsRes.data.map(b => ({ value: b.id, label: b.name }))
    sizes.value = sizesRes.data.map(s => ({ value: s.id, label: s.abbreviation }))
  } catch { /* ignore */ }
}

async function fetchArticles(brandId) {
  articles.value = []
  if (!brandId) return
  try {
    const res = await request(`/articles?brand_id=${brandId}&per_page=1000000`)
    articles.value = res.data.map(a => ({ value: a.id, label: a.name }))
  } catch { /* ignore */ }
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
        total_remaining: 0,
        total_excess_cutting: 0,
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
    articleGroup.entries.push({ id: item.id, size: item.size, size_id: item.size_id, total_pcs: item.total_pcs, cut_qty: item.cut_qty ?? 0, excess_cutting: item.excess_cutting ?? 0, remaining: item.remaining ?? item.total_pcs, cutting_results: item.cutting_results || [] })
    group.total_pcs += Number(item.total_pcs)
    group.total_remaining += Number(item.remaining ?? item.total_pcs)
    group.total_excess_cutting += Number(item.excess_cutting ?? 0)
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
  { key: 'total_remaining', label: t('preOrders.remaining') },
  { key: 'total_excess_cutting', label: t('preOrders.excessCutting') },
  { key: 'progress', label: t('brandDetail.progress') },
  { key: 'actions', label: t('common.actions') },
])

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

function getProgress(row) {
  if (!row.total_pcs || row.total_pcs === 0) return 0
  const cutQty = row.total_pcs - row.total_remaining
  return Math.round((cutQty / row.total_pcs) * 100)
}

function formatCutQty(entry) {
  if (!entry.cut_qty) return '0'
  return String(entry.cut_qty)
}

const showForm = ref(false)
const showDeleteModal = ref(false)
const editing = ref(null)
const deletingGroup = ref(null)
const deletingGroupHasDistributions = ref(false)
const formError = ref('')
const submitting = ref(false)

const showTrashModal = ref(false)
const trashedItems = ref([])
const loadingTrashed = ref(false)
const restoringId = ref(null)

async function openTrashModal() {
  showTrashModal.value = true
  loadingTrashed.value = true
  try {
    const res = await request('/pre-orders/trashed?per_page=100')
    trashedItems.value = res.data || []
  } catch (e) {
    trashedItems.value = []
  } finally {
    loadingTrashed.value = false
  }
}

async function restorePreOrder(id) {
  restoringId.value = id
  try {
    await request(`/pre-orders/${id}/restore`, { method: 'POST' })
    trashedItems.value = trashedItems.value.filter(i => i.id !== id)
    await fetchData(1)
  } catch (e) { /* ignore */ }
  restoringId.value = null
}

function formatDeletedAt(dateStr) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString()
}

function createEmptyArticle() {
  return { article_id: '', sizes: [{ size_id: '', total_pcs: '' }] }
}

const form = ref({
  brand_id: '',
  name: '',
  pre_order_date: '',
  deadline_date: '',
  articles: [createEmptyArticle()],
})

const skipArticleReset = ref(false)

watch(() => form.value.brand_id, (newBrandId) => {
  if (skipArticleReset.value) {
    skipArticleReset.value = false
    fetchArticles(newBrandId)
    return
  }
  form.value.articles.forEach(a => a.article_id = '')
  fetchArticles(newBrandId)
  if (!editing.value && newBrandId) {
    request(`/pre-orders/next-name?brand_id=${newBrandId}`).then(res => { nextName.value = res.name }).catch(() => {})
  }
})

function addArticle() {
  const newArticle = createEmptyArticle()
  form.value.articles = [...form.value.articles, newArticle]
  nextTick(() => {
    const idx = form.value.articles.length - 1
    const el = document.querySelector(`[data-article="${idx}"] input`)
    if (el) el.focus()
  })
}

function removeArticle(index) {
  if (form.value.articles.length > 1) {
    form.value.articles.splice(index, 1)
  }
}

function addSizeRow(articleIndex) {
  form.value.articles[articleIndex].sizes.push({ size_id: '', total_pcs: '' })
  nextTick(() => {
    const el = document.querySelector(`[data-size="${articleIndex}-${form.value.articles[articleIndex].sizes.length - 1}"] button`)
    if (el) el.click()
  })
}

function removeSizeRow(articleIndex, sizeIndex) {
  if (form.value.articles[articleIndex].sizes.length > 1) {
    form.value.articles[articleIndex].sizes.splice(sizeIndex, 1)
  }
}

function openAddForm() {
  editing.value = null
  // const today = new Date().toISOString().split('T')[0]
  const deadline = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]
  form.value = {
    brand_id: '',
    name: '',
    pre_order_date: today,
    deadline_date: deadline,
    articles: [createEmptyArticle()],
  }
  formError.value = ''
  nextName.value = ''
  articles.value = []
  fetchOptions()
  showForm.value = true
}

async function openEditForm(group) {
  editing.value = group
  skipArticleReset.value = true

  const articlesArr = group.articles.map(ag => ({
    article_id: ag.article_id,
    sizes: ag.entries.map(e => ({ size_id: e.size_id, total_pcs: String(e.total_pcs) })),
  }))

  form.value = {
    brand_id: group.brand_id,
    name: group.name,
    pre_order_date: group.pre_order_date ? group.pre_order_date.split('T')[0] : '',
    deadline_date: group.deadline_date ? group.deadline_date.split('T')[0] : '',
    articles: articlesArr.length ? articlesArr : [createEmptyArticle()],
  }
  formError.value = ''
  await fetchOptions()
  await fetchArticles(group.brand_id)
  showForm.value = true
}

function openDeleteModal(group) {
  deletingGroup.value = group
  deletingGroupHasDistributions.value = group.articles.some(ag =>
    ag.entries.some(entry =>
      entry.cutting_results.some(cr =>
        (cr.total_cutting - (cr.excess_cutting || 0) - (cr.remaining || 0)) > 0
      )
    )
  )
  showDeleteModal.value = true
}

async function handleSubmit() {
  formError.value = ''
  submitting.value = true
  try {
    const payload = {
      brand_id: form.value.brand_id,
      name: form.value.name || nextName.value,
      pre_order_date: form.value.pre_order_date,
      deadline_date: form.value.deadline_date,
      articles: form.value.articles.map(article => ({
        article_id: article.article_id,
        sizes: article.sizes.map(s => ({
          size_id: s.size_id,
          total_pcs: Number(s.total_pcs),
        })),
      })),
    }

    if (editing.value) {
      const existingSizes = editing.value.articles.flatMap(ag =>
        ag.entries.map(e => `${ag.article_id}_${e.size_id}`)
      )
      const formSizes = form.value.articles.flatMap(a =>
        a.sizes.map(s => `${a.article_id}_${s.size_id}`)
      )

      const sizesToAdd = form.value.articles.flatMap(a =>
        a.sizes.filter(s => !existingSizes.includes(`${a.article_id}_${s.size_id}`)).map(s => ({
          article_id: a.article_id,
          size_id: s.size_id,
          total_pcs: Number(s.total_pcs),
        }))
      )

      const sizesToRemove = editing.value.articles.flatMap(ag =>
        ag.entries.filter(e => !formSizes.includes(`${ag.article_id}_${e.size_id}`)).map(e => e.id)
      )

      for (const rawId of sizesToRemove) {
        await deleteItem(rawId)
      }

      for (const rawId of editing.value.rawIds) {
        const item = items.value.find(i => i.id === rawId)
        if (item && !sizesToRemove.includes(rawId)) {
          const formArticle = form.value.articles.find(a => a.article_id === item.article_id)
          const formSize = formArticle?.sizes.find(s => s.size_id === item.size_id)
          await request(`/pre-orders/${rawId}`, {
            method: 'PUT',
            body: JSON.stringify({
              brand_id: payload.brand_id,
              name: payload.name,
              pre_order_date: payload.pre_order_date,
              deadline_date: payload.deadline_date,
              article_id: item.article_id,
              size_id: item.size_id,
              total_pcs: formSize ? Number(formSize.total_pcs) : item.total_pcs,
            }),
          })
        }
      }

      if (sizesToAdd.length > 0) {
        await request('/pre-orders/batch', {
          method: 'POST',
          body: JSON.stringify({
            brand_id: payload.brand_id,
            name: payload.name,
            pre_order_date: payload.pre_order_date,
            deadline_date: payload.deadline_date,
            articles: groupSizesByArticle(sizesToAdd),
          }),
        })
      }
    } else {
      await request('/pre-orders/batch', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    }

    await fetchData(1)
    showForm.value = false
  } catch (e) {
    formError.value = e.message
  } finally {
    submitting.value = false
  }
}

function groupSizesByArticle(flatSizes) {
  const map = new Map()
  for (const s of flatSizes) {
    if (!map.has(s.article_id)) {
      map.set(s.article_id, { article_id: s.article_id, sizes: [] })
    }
    map.get(s.article_id).sizes.push({ size_id: s.size_id, total_pcs: s.total_pcs })
  }
  return Array.from(map.values())
}

async function handleDelete() {
  if (!deletingGroup.value) return
  try {
    for (const rawId of deletingGroup.value.rawIds) {
      await deleteItem(rawId)
    }
  } catch (e) { /* ignore */ }
  showDeleteModal.value = false
  deletingGroup.value = null
}
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-surface-900">{{ t('preOrders.title') }}</h1>
        <p class="mt-1 text-sm text-surface-500">{{ t('preOrders.description') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <Button variant="outline" @click="openTrashModal">
          <svg class="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
          {{ t('preOrders.viewTrash') }}
        </Button>
        <Button @click="openAddForm">+ {{ t('preOrders.addPreOrder') }}</Button>
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
        <p class="text-surface-500">{{ t('preOrders.noPreOrders') }}</p>
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
          <template #total_remaining="{ value }">
            <Badge :variant="value > 0 ? 'danger' : 'success'" size="sm">{{ value }}</Badge>
          </template>
          <template #total_excess_cutting="{ row }">
            <Badge v-if="row.total_excess_cutting > 0" variant="success" size="sm">+{{ row.total_excess_cutting }}</Badge>
            <span v-else class="text-surface-400">-</span>
          </template>
          <template #progress="{ row }">
            <div class="flex items-center gap-2">
              <div style="width: 60px; height: 6px; background: #e5e7eb; border-radius: 9999px; overflow: hidden;">
                <div :style="{ width: `${getProgress(row)}%`, height: '100%', background: '#3b82f6', borderRadius: '9999px' }"></div>
              </div>
              <span style="font-size: 11px; font-weight: 500; color: #374151;">{{ getProgress(row) }}%</span>
            </div>
          </template>
          <template #actions="{ row }">
            <div class="flex items-center gap-1">
              <button @click.stop="openEditForm(row)" class="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer" :title="t('common.edit')">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button @click.stop="openDeleteModal(row)" class="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer" :title="t('common.delete')">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
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
                      <th class="py-1.5 px-4 text-left font-medium text-surface-500">{{ t('preOrders.size') }}</th>
                      <th class="py-1.5 px-4 text-right font-medium text-surface-500">{{ t('preOrders.totalPcs') }}</th>
                      <th class="py-1.5 px-4 text-right font-medium text-surface-500">{{ t('preOrders.cutQty') }}</th>
                      <th class="py-1.5 px-4 text-right font-medium text-surface-500">{{ t('preOrders.remaining') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="entry in ag.entries" :key="entry.id" class="border-b border-surface-100 last:border-0">
                      <td class="py-1.5 px-4"><Badge variant="default" size="sm">{{ entry.size?.abbreviation || '-' }}</Badge></td>
                      <td class="py-1.5 px-4 text-right">{{ entry.total_pcs }}</td>
                      <td class="py-1.5 px-4">
                        <div class="flex items-center justify-end gap-1.5">
                          <span
                            v-if="entry.cutting_results && entry.cutting_results.length > 0"
                            class="cursor-help text-surface-800 font-medium"
                            @mouseenter="showTooltip(entry, $event)"
                            @mouseleave="hideTooltip"
                          >{{ entry.cut_qty }}<span v-if="entry.excess_cutting > 0" class="text-green-600"> (+{{ entry.excess_cutting }})</span></span>
                          <span v-else class="text-surface-800 font-medium">{{ entry.cut_qty }}<span v-if="entry.excess_cutting > 0" class="text-green-600"> (+{{ entry.excess_cutting }})</span></span>
                          <button
                            v-if="entry.cutting_results && entry.cutting_results.length > 0"
                            @click="openCuttingDetailForm(entry)"
                            class="p-1 rounded-md transition-colors cursor-pointer text-surface-600 hover:bg-surface-100"
                            :title="t('common.edit')"
                          >
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                          </button>
                          <!-- :disabled="entry.remaining <= 0" -->
                          <button
                            data-cutting-btn
                            @click="cuttingForm?.pre_order_id !== entry.id ? openCuttingForm(entry, row, $event) : (cuttingForm?.pre_order_id === entry.id ? closeCuttingForm() : null)"
                            class="p-1 rounded-md transition-colors cursor-pointer text-primary-600 hover:bg-primary-50"
                            :title="t('preOrders.addCuttingResult')"
                          >
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                          </button>
                        </div>
                      </td>
                      <td class="py-1.5 px-4 text-right"><Badge :variant="entry.remaining > 0 ? 'danger' : 'success'" size="sm">{{ entry.remaining }}</Badge></td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            </div>
          </template>
        </Table>
      </template>
    </Card>

    <Modal v-model="showForm" :title="editing ? t('preOrders.editPreOrder') : t('preOrders.addPreOrder')" size="lg" contentClass="h-[80vh]" :closeOnOverlay="false">
      <div class="space-y-4">
        <div v-if="formError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{{ formError }}</div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchableDropdown
            v-model="form.brand_id"
            :options="brands"
            :label="t('common.brand')"
            :placeholder="t('common.selectBrand')"
            required
          />
          <Input v-if="editing" :model-value="editing.name" :label="t('preOrders.preOrderName')" disabled />
          <Input v-else :model-value="nextName" :label="t('preOrders.preOrderName')" disabled :placeholder="t('preOrders.selectBrandFirst')" />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input v-model="form.pre_order_date" :label="t('preOrders.preOrderDate')" type="date" required />
          <Input v-model="form.deadline_date" :label="t('preOrders.deadlineDate')" type="date" required />
        </div>

        <div class="border-t border-surface-200 pt-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-surface-800">{{ t('preOrders.articles') }}</h3>
            <button @click="addArticle" type="button" class="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium cursor-pointer">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
              {{ t('preOrders.addArticle') }}
            </button>
          </div>

          <div v-for="(article, aIndex) in form.articles" :key="aIndex" :data-article="aIndex" class="mb-4 p-4 bg-surface-50 rounded-lg border border-surface-200">
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm font-medium text-surface-700">{{ form.articles.length > 1 ? `${t('preOrders.article')} ${aIndex + 1}` : t('preOrders.article') }}</span>
              <button v-if="form.articles.length > 1" @click="removeArticle(aIndex)" type="button" class="text-red-500 hover:text-red-700 text-sm cursor-pointer">
                {{ t('preOrders.removeArticle') }}
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
              <SearchableDropdown
                v-model="article.article_id"
                :options="articles"
                :label="t('preOrders.article')"
                :placeholder="t('preOrders.selectArticle')"
                :disabled="!form.brand_id"
                required
              />
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-medium text-surface-500">Sizes & Quantities</span>
                <button @click="addSizeRow(aIndex)" type="button" class="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium cursor-pointer">
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                  {{ t('preOrders.addSize') }}
                </button>
              </div>
              <div v-for="(sizeItem, sIndex) in article.sizes" :key="sIndex" :data-size="`${aIndex}-${sIndex}`" class="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                <SearchableDropdown
                  v-model="sizeItem.size_id"
                  :options="sizes"
                  :label="article.sizes.length > 1 ? `${t('preOrders.size')} ${sIndex + 1}` : t('preOrders.size')"
                  :placeholder="t('preOrders.selectSize')"
                  required
                />
                <div class="flex items-end gap-2">
                  <div class="flex-1">
                    <Input v-model="sizeItem.total_pcs" :label="article.sizes.length > 1 ? `${t('common.pcs')} ${sIndex + 1}` : t('common.totalPcs')" type="number" placeholder="0" required />
                  </div>
                  <button v-if="article.sizes.length > 1" @click="removeSizeRow(aIndex, sIndex)" type="button" class="p-2 mb-0.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors cursor-pointer" :title="t('preOrders.remove')">
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showForm = false">{{ t('common.cancel') }}</Button>
          <Button :loading="submitting" @click="handleSubmit">{{ editing ? t('common.update') : t('common.create') }}</Button>
        </div>
      </template>
    </Modal>

    <Modal v-model="showDeleteModal" :title="t('preOrders.deleteTitle')" size="sm" :closeOnOverlay="false">
      <div class="space-y-3">
        <p class="text-surface-700">{{ t('preOrders.deleteMessage', { name: deletingGroup?.name }) }}</p>
        <div v-if="deletingGroupHasDistributions" class="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-800 text-sm">
          {{ t('preOrders.deleteWarningDistributed') }}
        </div>
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showDeleteModal = false">{{ t('common.cancel') }}</Button>
          <Button variant="danger" @click="handleDelete">{{ t('common.delete') }}</Button>
        </div>
      </template>
    </Modal>

    <Modal v-model="showTrashModal" :title="t('preOrders.trashTitle')" size="lg">
      <div v-if="loadingTrashed" class="flex items-center justify-center py-8">
        <svg class="animate-spin h-6 w-6 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      <div v-else-if="trashedItems.length === 0" class="text-center py-8 text-surface-400">
        {{ t('preOrders.noDeletedPreOrders') }}
      </div>
      <div v-else class="space-y-2 max-h-[60vh] overflow-y-auto">
        <div
          v-for="item in trashedItems"
          :key="item.id"
          class="flex items-center justify-between p-3 border border-surface-200 rounded-lg hover:bg-surface-50"
        >
          <div class="flex flex-col gap-0.5">
            <span class="font-medium text-surface-800 text-sm">{{ item.name }}</span>
            <div class="flex items-center gap-2 text-xs text-surface-500">
              <span v-if="item.brand">{{ item.brand.name }}</span>
              <span v-if="item.article"> · {{ item.article.name }}</span>
              <span v-if="item.size"> · {{ item.size.abbreviation }}</span>
              <span> · {{ item.total_pcs }} pcs</span>
            </div>
            <span class="text-xs text-red-500">{{ t('preOrders.deletedAt') }}: {{ formatDeletedAt(item.deleted_at) }}</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            :loading="restoringId === item.id"
            @click="restorePreOrder(item.id)"
          >
            {{ restoringId === item.id ? t('preOrders.restoring') : t('preOrders.restore') }}
          </Button>
        </div>
      </div>
      <template #footer>
        <Button variant="outline" @click="showTrashModal = false">{{ t('common.close') }}</Button>
      </template>
    </Modal>

    <Teleport to="body">
      <div v-if="cuttingForm" ref="cuttingFormRef" class="fixed z-50 bg-white rounded-lg border border-surface-200 p-4 w-72" :style="cuttingFormStyle">
        <div v-if="cuttingError" class="p-2 mb-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{{ cuttingError }}</div>
        <div class="space-y-3">
          <Input v-model="cuttingForm.cutting_date" :label="t('preOrders.cuttingDate')" type="date" required />
          <Input v-model="cuttingForm.total_cutting" :label="t('preOrders.cutQty')" type="number" placeholder="0" required />
          <p class="text-xs text-surface-500">{{ t('preOrders.remainingAvailable') }} <strong>{{ cuttingForm.remaining }}</strong></p>
          <div class="flex items-center gap-2 pt-1">
            <Button :loading="cuttingSubmitting" @click="submitCuttingResult" size="sm">{{ t('common.create') }}</Button>
            <Button variant="outline" @click="closeCuttingForm" size="sm">{{ t('common.cancel') }}</Button>
          </div>
        </div>
      </div>
      <div v-if="tooltipData" class="fixed z-50 w-56 p-2 bg-black/80 text-white rounded-lg shadow-lg text-xs" :style="tooltipStyle" @mouseenter="() => {}" @mouseleave="hideTooltip">
        <div class="space-y-1">
          <div v-for="(cut, idx) in tooltipData" :key="idx">
            {{ formatDate(cut.cutting_date) }}: <strong>{{ cut.total_cutting }} {{ t('common.pcs') }}</strong>
          </div>
        </div>
      </div>
      <Modal v-model="showCuttingDetailModal" :title="t('preOrders.cuttingDetails')" size="md" :closeOnOverlay="false">
        <div v-if="cuttingDetailError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">{{ cuttingDetailError }}</div>
        <div v-if="cuttingDetailForm && cuttingDetailForm.cutting_results.length === 0" class="text-center py-8 text-surface-400">{{ t('preOrders.noCuttings') }}</div>
        <div v-else class="space-y-3 max-h-96 overflow-y-auto">
          <div v-for="c in cuttingDetailForm?.cutting_results || []" :key="c.id" class="p-3 border border-surface-200 rounded-lg">
            <div v-if="editingCutting?.id === c.id" class="space-y-3">
              <Input v-model="editingCutting.cutting_date" :label="t('preOrders.cuttingDate')" type="date" required />
              <Input v-model="editingCutting.total_cutting" :label="t('preOrders.cutQty')" type="number" placeholder="0" required />
              <div class="flex items-center gap-2">
                <Button :loading="cuttingDetailSubmitting" @click="updateCutting" size="sm">{{ t('common.save') }}</Button>
                <Button variant="outline" @click="cancelEditCutting" size="sm">{{ t('common.cancel') }}</Button>
              </div>
            </div>
            <div v-else class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <span class="text-sm text-surface-600">{{ formatDate(c.cutting_date) }}</span>
                <Badge variant="primary" size="sm">{{ c.total_cutting }} {{ t('common.pcs') }}</Badge>
              </div>
              <div class="flex items-center gap-1">
                <button @click="startEditCutting(c)" class="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer" :title="t('common.edit')">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
                </button>
                <button @click="deleteCutting(c)" class="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer" :title="t('common.delete')">
                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
        <template #footer>
          <Button variant="outline" @click="closeCuttingDetailForm">{{ t('common.close') }}</Button>
        </template>
      </Modal>
      <Modal v-model="showCuttingDeleteModal" :title="t('common.delete')" size="sm" :closeOnOverlay="false" style="z-index: 40">
        <div class="space-y-3">
          <p class="text-surface-700">{{ t('common.cannotUndo') }}</p>
          <div v-if="deletingCuttingHasDistributions" class="p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-800 text-sm">
            {{ t('preOrders.deleteCuttingWarningDistributed') }}
          </div>
        </div>
        <template #footer>
          <div class="flex justify-end gap-3">
            <Button variant="outline" @click="closeCuttingDeleteModal">{{ t('common.cancel') }}</Button>
            <Button variant="danger" @click="confirmDeleteCutting">{{ t('common.delete') }}</Button>
          </div>
        </template>
      </Modal>
    </Teleport>
  </div>
</template>
