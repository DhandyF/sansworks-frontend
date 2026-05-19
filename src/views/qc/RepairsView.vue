<script setup>
import { ref, watch, computed, onMounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMasterData } from '@/composables/useMasterData'
import { useApi } from '@/composables/useApi'
import { useDebounce } from '@/composables/useDebounce'
import { Button, Card, Table, Badge, Input, Modal, SearchableDropdown } from 'ui-assets'

const { t } = useI18n()

const search = ref('')
const tailorFilter = ref('')
const brandFilter = ref('')
const articleFilter = ref('')
const { debounce } = useDebounce(500)

const { items, loading, fetchData, deleteItem } = useMasterData('/repairs', () => ({
  search: search.value,
  tailor_filter: tailorFilter.value,
  brand_filter: brandFilter.value,
  article_filter: articleFilter.value,
}), { perPage: 1000000 })

watch([search, tailorFilter, brandFilter, articleFilter], () => debounce(() => fetchData(1)))

const { request } = useApi()
const tailors = ref([])
const brands = ref([])
const articles = ref([])

onMounted(async () => {
  try {
    const [tailorsRes, brandsRes] = await Promise.all([
      request('/tailors?per_page=1000000'),
      request('/brands?per_page=1000000'),
    ])
    tailors.value = tailorsRes.data.map(t => ({ value: t.id, label: t.name }))
    brands.value = brandsRes.data.map(b => ({ value: b.id, label: b.name }))
  } catch { /* ignore */ }
})

async function fetchArticles(brandId) {
  articles.value = []
  if (!brandId) return
  try {
    const res = await request(`/articles?brand_id=${brandId}&per_page=1000000`)
    articles.value = res.data.map(a => ({ value: a.id, label: a.name }))
  } catch { /* ignore */ }
}

const filterTailors = ref([])
const filterBrands = ref([])
const filterArticles = ref([])

onMounted(async () => {
  try {
    const [tRes, bRes] = await Promise.all([
      request('/tailors?per_page=1000000'),
      request('/brands?per_page=1000000'),
    ])
    filterTailors.value = tRes.data.map(t => ({ value: t.id, label: t.name }))
    filterBrands.value = bRes.data.map(b => ({ value: b.id, label: b.name }))
  } catch { /* ignore */ }
})

watch(brandFilter, async (newVal) => {
  if (newVal) {
    try {
      const res = await request(`/articles?brand_id=${newVal}&per_page=1000000`)
      filterArticles.value = res.data.map(a => ({ value: a.id, label: a.name }))
    } catch { /* ignore */ }
  } else {
    filterArticles.value = []
  }
})

const showForm = ref(false)
const showDeleteModal = ref(false)
const editing = ref(null)
const deleting = ref(null)
const formError = ref('')
const submitting = ref(false)
const generatedName = ref('')

const form = ref({
  tailor_id: '',
  brand_id: '',
  article_id: '',
  name: '',
  total_repair: '',
  sewing_price: '',
  taken_date: '',
  deadline_date: '',
})

watch(() => form.value.brand_id, (newVal) => {
  form.value.article_id = ''
  fetchArticles(newVal)
})

watch([() => form.value.tailor_id, () => form.value.article_id], async () => {
  if (form.value.tailor_id && form.value.article_id) {
    try {
      const res = await request('/repairs/generate-name', {
        params: { tailor_id: form.value.tailor_id, article_id: form.value.article_id },
      })
      generatedName.value = res.name
      if (!editing.value) {
        form.value.name = res.name
      }
    } catch { /* ignore */ }
  }
})

const skipArticleReset = ref(false)

function openAddForm() {
  editing.value = null
  const today = new Date().toISOString().split('T')[0]
  const deadline = new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0]
  form.value = {
    tailor_id: '',
    brand_id: '',
    article_id: '',
    name: '',
    total_repair: '',
    sewing_price: '',
    taken_date: today,
    deadline_date: deadline,
  }
  formError.value = ''
  generatedName.value = ''
  showForm.value = true
}

async function openEditForm(item) {
  editing.value = item
  skipArticleReset.value = true
  form.value = {
    tailor_id: item.tailor_id,
    brand_id: item.brand_id,
    article_id: item.article_id,
    name: item.name,
    total_repair: String(item.total_repair),
    sewing_price: String(item.sewing_price),
    taken_date: item.taken_date ? item.taken_date.split('T')[0] : '',
    deadline_date: item.deadline_date ? item.deadline_date.split('T')[0] : '',
  }
  formError.value = ''
  await fetchArticles(item.brand_id)
  showForm.value = true
}

function openDeleteModal(item) {
  deleting.value = item
  showDeleteModal.value = true
}

async function handleSubmit() {
  formError.value = ''
  submitting.value = true
  try {
    const payload = {
      tailor_id: form.value.tailor_id,
      brand_id: form.value.brand_id,
      article_id: form.value.article_id,
      name: form.value.name || generatedName.value,
      total_repair: Number(form.value.total_repair),
      sewing_price: Number(form.value.sewing_price),
      taken_date: form.value.taken_date,
      deadline_date: form.value.deadline_date,
    }
    if (editing.value) {
      await request(`/repairs/${editing.value.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
    } else {
      await request('/repairs', {
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

async function handleDelete() {
  if (!deleting.value) return
  try {
    await deleteItem(deleting.value.id)
  } catch { /* ignore */ }
  showDeleteModal.value = false
  deleting.value = null
}

function formatDate(dateStr) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
}

const statusBadge = (status) => {
  if (status === 'done') return 'success'
  if (status === 'overdue') return 'danger'
  return 'warning'
}

const statusLabel = (status) => {
  if (status === 'done') return t('common.done')
  if (status === 'overdue') return t('common.overdue')
  return t('common.inProgress')
}

const columns = computed(() => [
  { key: 'name', label: t('repairs.repairName') },
  { key: 'tailor', label: t('repairs.tailor') },
  { key: 'brand', label: t('repairs.brand') },
  { key: 'article', label: t('repairs.article') },
  { key: 'total_repair', label: t('repairs.totalRepair') },
  { key: 'sewing_price', label: t('repairs.sewingPrice') },
  { key: 'remaining', label: t('repairs.remaining') },
  { key: 'taken_date', label: t('repairs.takenDate') },
  { key: 'deadline_date', label: t('repairs.deadlineDate') },
  { key: 'status', label: t('repairs.status') },
  { key: 'actions', label: t('common.actions') },
])
</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-surface-900">{{ t('repairs.title') }}</h1>
        <p class="mt-1 text-sm text-surface-500">{{ t('repairs.description') }}</p>
      </div>
      <Button @click="openAddForm">+ {{ t('repairs.addRepair') }}</Button>
    </div>

    <div class="flex flex-col sm:flex-row gap-3 mb-4">
      <div class="sm:w-48">
        <SearchableDropdown v-model="tailorFilter" :options="filterTailors" label="" :placeholder="t('repairs.selectTailor')" clearable />
      </div>
      <div class="sm:w-48">
        <SearchableDropdown v-model="brandFilter" :options="filterBrands" label="" :placeholder="t('common.allBrands')" clearable />
      </div>
      <div class="sm:w-48" v-if="brandFilter">
        <SearchableDropdown v-model="articleFilter" :options="filterArticles" label="" :placeholder="t('repairs.selectArticle')" clearable />
      </div>
      <div class="flex-1">
        <Input v-model="search" label="" :placeholder="t('repairs.searchPlaceholder')" />
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
        <p class="text-surface-500">{{ t('repairs.noRepairs') }}</p>
      </div>
      <template v-else>
        <Table :columns="columns" :rows="items" :per-page="15">
          <template #name="{ value }"><span class="whitespace-nowrap font-medium text-surface-800">{{ value }}</span></template>
          <template #tailor="{ value }">{{ value?.name || '-' }}</template>
          <template #brand="{ value }"><Badge variant="primary" size="sm">{{ value?.name || '-' }}</Badge></template>
          <template #article="{ value }">{{ value?.name || '-' }}</template>
          <template #total_repair="{ value }"><span class="block text-right">{{ value }}</span></template>
          <template #sewing_price="{ value }"><span class="block text-right">{{ Number(value).toLocaleString('id-ID') }}</span></template>
          <template #remaining="{ row }">
            <Badge :variant="(row.total_repair - (row.total_deposited ?? 0)) > 0 ? 'success' : 'danger'" size="sm">
              {{ row.total_repair - (row.total_deposited ?? 0) }}
            </Badge>
          </template>
          <template #taken_date="{ value }">{{ formatDate(value) }}</template>
          <template #deadline_date="{ value }">{{ formatDate(value) }}</template>
          <template #status="{ value }"><Badge :variant="statusBadge(value)" size="sm">{{ statusLabel(value) }}</Badge></template>
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
        </Table>
      </template>
    </Card>

    <Modal v-model="showForm" :title="editing ? t('repairs.editRepair') : t('repairs.addRepair')" size="lg" :closeOnOverlay="false">
      <div class="space-y-4">
        <div v-if="formError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{{ formError }}</div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchableDropdown v-model="form.tailor_id" :options="tailors" :label="t('repairs.tailor')" :placeholder="t('repairs.selectTailor')" required />
          <SearchableDropdown v-model="form.brand_id" :options="brands" :label="t('repairs.brand')" :placeholder="t('common.selectBrand')" required />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <SearchableDropdown v-model="form.article_id" :options="articles" :label="t('repairs.article')" :placeholder="t('repairs.selectArticle')" :disabled="!form.brand_id" required />
          <div>
            <Input v-model="form.name" :label="t('repairs.repairName')" :placeholder="editing ? '' : t('repairs.nameAutoGenerated')" :disabled="!!editing" required />
            <p v-if="!editing && generatedName" class="text-xs text-surface-500 mt-1">{{ generatedName }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input v-model="form.total_repair" :label="t('repairs.totalRepair')" type="number" placeholder="0" required />
          <Input v-model="form.sewing_price" :label="t('repairs.sewingPrice')" type="number" placeholder="0" required />
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input v-model="form.taken_date" :label="t('repairs.takenDate')" type="date" required />
          <div>
            <Input v-model="form.deadline_date" :label="t('repairs.deadlineDate')" type="date" required />
            <p class="text-xs text-surface-500 mt-1">{{ t('repairs.deadlineHint') }}</p>
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

    <Modal v-model="showDeleteModal" :title="t('repairs.deleteTitle')" size="sm" :closeOnOverlay="false">
      <p class="text-surface-700">{{ t('repairs.deleteMessage') }}</p>
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