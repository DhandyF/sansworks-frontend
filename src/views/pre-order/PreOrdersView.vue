<script setup>
import { ref, watch, computed, onMounted } from 'vue'
import { useMasterData } from '@/composables/useMasterData'
import { useApi } from '@/composables/useApi'
import { useDebounce } from '@/composables/useDebounce'
import { Button, Card, Table, Badge, Input, Modal, SearchableDropdown } from 'ui-assets'

const search = ref('')
const brandFilter = ref('')
const { debounce } = useDebounce(500)

const { items, loading, fetchData, deleteItem } = useMasterData('/pre-orders', () => ({ search: search.value, brand_filter: brandFilter.value }))

watch([search, brandFilter], () => debounce(() => fetchData(1)))

const { request } = useApi()
const brands = ref([])
const sizes = ref([])
const articles = ref([])
const nextName = ref('')

let filterBrandsLoaded = false
const filterBrands = ref([])

onMounted(async () => {
  if (!filterBrandsLoaded) {
    try {
      const res = await request('/brands?per_page=1000')
      filterBrands.value = res.data.map(b => ({ value: b.id, label: b.name }))
      filterBrandsLoaded = true
    } catch { /* ignore */ }
  }
})

async function fetchOptions() {
  if (brands.value.length) return
  try {
    const [brandsRes, sizesRes] = await Promise.all([
      request('/brands?per_page=1000'),
      request('/sizes?per_page=1000'),
    ])
    brands.value = brandsRes.data.map(b => ({ value: b.id, label: b.name }))
    sizes.value = sizesRes.data.map(s => ({ value: s.id, label: s.abbreviation }))
  } catch { /* ignore */ }
}

async function fetchArticles(brandId) {
  articles.value = []
  if (!brandId) return
  try {
    const res = await request(`/articles?brand_id=${brandId}&per_page=1000`)
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
    articleGroup.entries.push({ id: item.id, size: item.size, size_id: item.size_id, total_pcs: item.total_pcs, cut_qty: item.cut_qty ?? 0, remaining: item.remaining ?? item.total_pcs })
    group.total_pcs += Number(item.total_pcs)
    group.total_remaining += Number(item.remaining ?? item.total_pcs)
    group.rawIds.push(item.id)
  }
  return Array.from(map.values())
})

const columns = [
  { key: 'brand', label: 'Brand' },
  { key: 'name', label: 'Pre-Order Name' },
  { key: 'pre_order_date', label: 'Order Date' },
  { key: 'deadline_date', label: 'Deadline' },
  { key: 'total_pcs', label: 'Total Pcs' },
  { key: 'total_remaining', label: 'Remaining' },
  { key: 'actions', label: 'Actions' },
]

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const showForm = ref(false)
const showDeleteModal = ref(false)
const editing = ref(null)
const deletingGroup = ref(null)
const formError = ref('')
const submitting = ref(false)

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
  form.value.articles.push(createEmptyArticle())
}

function removeArticle(index) {
  if (form.value.articles.length > 1) {
    form.value.articles.splice(index, 1)
  }
}

function addSizeRow(articleIndex) {
  form.value.articles[articleIndex].sizes.push({ size_id: '', total_pcs: '' })
}

function removeSizeRow(articleIndex, sizeIndex) {
  if (form.value.articles[articleIndex].sizes.length > 1) {
    form.value.articles[articleIndex].sizes.splice(sizeIndex, 1)
  }
}

function openAddForm() {
  editing.value = null
  form.value = {
    brand_id: '',
    name: '',
    pre_order_date: '',
    deadline_date: '',
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
      for (const rawId of editing.value.rawIds) {
        await deleteItem(rawId)
      }
    }

    await request('/pre-orders/batch', {
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
        <h1 class="text-2xl font-bold text-surface-900">Pre-Orders</h1>
        <p class="mt-1 text-sm text-surface-500">Manage pre-orders for production</p>
      </div>
      <Button @click="openAddForm">+ Add Pre-Order</Button>
    </div>

    <div class="flex flex-col sm:flex-row gap-3 mb-4">
      <div class="sm:w-64">
        <SearchableDropdown
          v-model="brandFilter"
          :options="filterBrands"
          label=""
          placeholder="All brands"
          clearable
        />
      </div>
      <div class="flex-1">
        <Input v-model="search" label="" placeholder="Search by pre-order name..." />
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
        <p class="text-surface-500">No pre-orders found</p>
      </div>
      <template v-else>
        <Table :columns="columns" :rows="groupedOrders" expandable :per-page="15">
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
            <Badge :variant="value > 0 ? 'success' : 'danger'" size="sm">{{ value }}</Badge>
          </template>
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
          <template #expanded="{ row }">
            <div class="space-y-3">
              <Card v-for="ag in row.articles" :key="ag.article_id" variant="bordered" class="shadow-none!">
                <div class="px-4 py-2 border-b border-surface-200">
                  <span class="text-sm font-medium text-surface-800">{{ ag.article?.name || '-' }}</span>
                </div>
                <table class="w-full text-sm">
                  <thead>
                    <tr class="border-b border-surface-200">
                      <th class="py-1.5 px-4 text-left font-medium text-surface-500">Size</th>
                      <th class="py-1.5 px-4 text-right font-medium text-surface-500">Total Pcs</th>
                      <th class="py-1.5 px-4 text-right font-medium text-surface-500">Cut Qty</th>
                      <th class="py-1.5 px-4 text-right font-medium text-surface-500">Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="entry in ag.entries" :key="entry.id" class="border-b border-surface-100 last:border-0">
                      <td class="py-1.5 px-4"><Badge variant="default" size="sm">{{ entry.size?.abbreviation || '-' }}</Badge></td>
                      <td class="py-1.5 px-4 text-right">{{ entry.total_pcs }}</td>
                      <td class="py-1.5 px-4 text-right">{{ entry.cut_qty }}</td>
                      <td class="py-1.5 px-4 text-right"><Badge :variant="entry.remaining > 0 ? 'success' : 'danger'" size="sm">{{ entry.remaining }}</Badge></td>
                    </tr>
                  </tbody>
                </table>
              </Card>
            </div>
          </template>
        </Table>
      </template>
    </Card>

    <Modal v-model="showForm" :title="editing ? 'Edit Pre-Order' : 'Add Pre-Order'" size="lg" contentClass="h-[80vh]" :closeOnOverlay="false">
      <div class="space-y-4">
        <div v-if="formError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{{ formError }}</div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchableDropdown
            v-model="form.brand_id"
            :options="brands"
            label="Brand"
            placeholder="Select a brand"
            required
          />
          <Input v-if="editing" :model-value="editing.name" label="Pre-Order Name" disabled />
          <Input v-else :model-value="nextName" label="Pre-Order Name" disabled placeholder="Select a brand first..." />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input v-model="form.pre_order_date" label="Pre-Order Date" type="date" required />
          <Input v-model="form.deadline_date" label="Deadline Date" type="date" required />
        </div>

        <div class="border-t border-surface-200 pt-4">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-semibold text-surface-800">Articles</h3>
            <button @click="addArticle" type="button" class="inline-flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium cursor-pointer">
              <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
              Add Article
            </button>
          </div>

          <div v-for="(article, aIndex) in form.articles" :key="aIndex" class="mb-4 p-4 bg-surface-50 rounded-lg border border-surface-200">
            <div class="flex items-center justify-between mb-3">
              <span class="text-sm font-medium text-surface-700">Article {{ form.articles.length > 1 ? aIndex + 1 : '' }}</span>
              <button v-if="form.articles.length > 1" @click="removeArticle(aIndex)" type="button" class="text-red-500 hover:text-red-700 text-sm cursor-pointer">
                Remove Article
              </button>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
              <SearchableDropdown
                v-model="article.article_id"
                :options="articles"
                label="Article"
                placeholder="Select an article"
                :disabled="!form.brand_id"
                required
              />
            </div>

            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-xs font-medium text-surface-500">Sizes & Quantities</span>
                <button @click="addSizeRow(aIndex)" type="button" class="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium cursor-pointer">
                  <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/></svg>
                  Add Size
                </button>
              </div>
              <div v-for="(sizeItem, sIndex) in article.sizes" :key="sIndex" class="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                <SearchableDropdown
                  v-model="sizeItem.size_id"
                  :options="sizes"
                  :label="`Size ${article.sizes.length > 1 ? sIndex + 1 : ''}`"
                  placeholder="Select a size"
                  required
                />
                <div class="flex items-end gap-2">
                  <div class="flex-1">
                    <Input v-model="sizeItem.total_pcs" :label="article.sizes.length > 1 ? `Pcs ${sIndex + 1}` : 'Total Pcs'" type="number" placeholder="0" required />
                  </div>
                  <button v-if="article.sizes.length > 1" @click="removeSizeRow(aIndex, sIndex)" type="button" class="p-2 mb-0.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors cursor-pointer" title="Remove">
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
          <Button variant="outline" @click="showForm = false">Cancel</Button>
          <Button :loading="submitting" @click="handleSubmit">{{ editing ? 'Update' : 'Create' }}</Button>
        </div>
      </template>
    </Modal>

    <Modal v-model="showDeleteModal" title="Delete Pre-Order" size="sm" :closeOnOverlay="false">
      <p class="text-surface-700">Are you sure you want to delete <strong>{{ deletingGroup?.name }}</strong>? This will remove all sizes in this pre-order. This action cannot be undone.</p>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showDeleteModal = false">Cancel</Button>
          <Button variant="danger" @click="handleDelete">Delete</Button>
        </div>
      </template>
    </Modal>
  </div>
</template>
