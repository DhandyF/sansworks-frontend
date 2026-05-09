<script setup>
import { ref, watch, onMounted } from 'vue'
import { useMasterData } from '@/composables/useMasterData'
import { useApi } from '@/composables/useApi'
import { useDebounce } from '@/composables/useDebounce'
import { Button, Card, Table, Badge, Input, Modal, SearchableDropdown } from 'ui-assets'

const search = ref('')
const brandFilter = ref('')
const { debounce } = useDebounce(500)

const { items, loading, pagination, fetchData, addItem, editItem, deleteItem } = useMasterData('/articles', () => ({ search: search.value, brand_filter: brandFilter.value }))

watch([search, brandFilter], () => debounce(() => fetchData(1)))

const { request } = useApi()
const brands = ref([])
const brandsLoading = ref(false)
const brandsLoaded = ref(false)

async function fetchBrands() {
  if (brandsLoaded.value) return
  brandsLoading.value = true
  try {
    const res = await request('/brands?per_page=1000')
    brands.value = res.data.map(b => ({ value: b.id, label: b.name }))
    brandsLoaded.value = true
  } finally {
    brandsLoading.value = false
  }
}

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'brand', label: 'Brand' },
  { key: 'description', label: 'Description' },
  { key: 'actions', label: 'Actions' },
]

const showForm = ref(false)
const showDeleteModal = ref(false)
const editing = ref(null)
const deletingItem = ref(null)
const formError = ref('')
const submitting = ref(false)

const form = ref({ brand_id: '', name: '', description: '' })

const brandArticles = ref([])
const brandArticlesLoading = ref(false)

onMounted(fetchBrands)

watch(() => form.value.brand_id, async (newBrandId) => {
  brandArticles.value = []
  if (!newBrandId) return
  brandArticlesLoading.value = true
  try {
    const res = await request(`/articles?brand_id=${newBrandId}&per_page=1000`)
    brandArticles.value = res.data || []
  } catch { /* ignore */ } finally {
    brandArticlesLoading.value = false
  }
})

function openAddForm() {
  editing.value = null
  form.value = { brand_id: '', name: '', description: '' }
  formError.value = ''
  fetchBrands()
  showForm.value = true
}

function openEditForm(item) {
  editing.value = item
  form.value = { brand_id: item.brand_id, name: item.name, description: item.description || '' }
  formError.value = ''
  fetchBrands()
  showForm.value = true
}

function openDeleteModal(item) {
  deletingItem.value = item
  showDeleteModal.value = true
}

async function handleSubmit() {
  formError.value = ''
  submitting.value = true
  try {
    if (editing.value) {
      await editItem(editing.value.id, form.value)
    } else {
      await addItem(form.value)
    }
    showForm.value = false
  } catch (e) {
    formError.value = e.message
  } finally {
    submitting.value = false
  }
}

async function handleDelete() {
  if (!deletingItem.value) return
  try {
    await deleteItem(deletingItem.value.id)
  } catch (e) { /* ignore */ }
  showDeleteModal.value = false
  deletingItem.value = null
}


</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-surface-900">Articles</h1>
        <p class="mt-1 text-sm text-surface-500">Manage articles and their brands</p>
      </div>
      <Button @click="openAddForm">+ Add Article</Button>
    </div>

    <div class="flex flex-col sm:flex-row gap-3 mb-4">
      <div class="sm:w-64">
        <SearchableDropdown
          v-model="brandFilter"
          :options="brands"
          label=""
          placeholder="All brands"
          clearable
        />
      </div>
      <div class="flex-1">
        <Input v-model="search" label="" placeholder="Search by article name..." />
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
        <p class="text-surface-500">No articles found</p>
      </div>
      <template v-else>
        <Table :columns="columns" :rows="items" :pagination="pagination" @page-change="fetchData">
          <template #brand="{ row }">
            <Badge variant="primary" size="sm">{{ row.brand?.name || '-' }}</Badge>
          </template>
          <template #description="{ value }">
            <span class="text-surface-500 line-clamp-2">{{ value || '-' }}</span>
          </template>
          <template #actions="{ row }">
            <div class="flex items-center gap-1">
              <button @click="openEditForm(row)" class="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer" title="Edit">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button @click="openDeleteModal(row)" class="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer" title="Delete">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </template>
        </Table>
      </template>
    </Card>

    <Modal v-model="showForm" :title="editing ? 'Edit Article' : 'Add Article'" size="md" contentClass="h-[80vh]" :closeOnOverlay="false">
      <div class="space-y-4">
        <div v-if="formError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{{ formError }}</div>
        <SearchableDropdown
          v-model="form.brand_id"
          :options="brands"
          label="Brand"
          placeholder="Select a brand"
          required
        />
        <div v-if="brandArticlesLoading" class="text-sm text-surface-400">Loading articles...</div>
        <div v-else-if="brandArticles.length > 0" class="space-y-1">
          <p class="text-sm font-medium text-surface-700">Existing articles for this brand:</p>
          <div class="flex flex-wrap gap-1.5">
            <Badge v-for="article in brandArticles" :key="article.id" variant="default" size="sm">{{ article.name }}</Badge>
          </div>
        </div>
        <Input :model-value="form.name" @update:model-value="v => form.name = v.toUpperCase()" label="Article Name" placeholder="Article name" required />
        <Input v-model="form.description" label="Description" type="textarea" placeholder="Optional description" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showForm = false">Cancel</Button>
          <Button :loading="submitting" @click="handleSubmit">{{ editing ? 'Update' : 'Create' }}</Button>
        </div>
      </template>
    </Modal>

    <Modal v-model="showDeleteModal" title="Delete Article" size="sm" :closeOnOverlay="false">
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
