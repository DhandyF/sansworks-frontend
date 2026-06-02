<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useMasterData } from '@/composables/useMasterData'
import { useDebounce } from '@/composables/useDebounce'
import { useApi } from '@/composables/useApi'
import { Button, Card, Table, Badge, Input, Modal, SearchableDropdown } from 'ui-assets'

const { t } = useI18n()
const search = ref('')
const { debounce } = useDebounce(500)
const { request } = useApi()

const { items, loading, pagination, fetchData, addItem, editItem, deleteItem } = useMasterData('/users', () => ({ search: search.value }))

const brands = ref([])

const roleOptions = [
  { value: 'admin', label: t('users.admin') },
  { value: 'client', label: t('users.client') },
  { value: 'operator', label: t('users.operator') },
]

const statusOptions = [
  { value: 'active', label: t('common.active') },
  { value: 'inactive', label: t('common.inactive') },
]

const form = ref({ name: '', username: '', password: '', phone: '', role: 'operator', status: 'active', brand_id: '' })

onMounted(async () => {
  await fetchBrands()
  fetchData(1)
})

async function fetchBrands() {
  try {
    const res = await request('/brands?per_page=1000')
    brands.value = res.data.map(b => ({ value: b.id, label: b.name }))
  } catch {
    // ignore
  }
}

watch(search, () => debounce(() => fetchData(1)))

watch(() => form.value.role, (newRole, oldRole) => {
  if (oldRole === 'client' && newRole !== 'client') {
    form.value.brand_id = ''
  }
}, { flush: 'post' })

const columns = computed(() => [
  { key: 'name', label: t('common.name') },
  { key: 'username', label: t('users.username') },
  { key: 'phone', label: t('common.phone') },
  { key: 'role', label: t('users.role') },
  { key: 'status', label: t('common.status') },
  { key: 'actions', label: t('common.actions') },
])

const showForm = ref(false)
const showDeleteModal = ref(false)
const editing = ref(null)
const deletingItem = ref(null)
const formError = ref('')
const submitting = ref(false)

const showPassword = ref(false)

function upper(v) { return typeof v === 'string' ? v.toUpperCase() : v }

function openAddForm() {
  editing.value = null
  form.value = { name: '', username: '', password: '', phone: '', role: 'operator', status: 'active', brand_id: '' }
  formError.value = ''
  showForm.value = true
}

function openEditForm(item) {
  editing.value = item
  form.value = {
    name: item.name,
    username: item.username,
    password: '',
    phone: item.phone || '',
    role: item.role,
    status: item.status,
    brand_id: item.brands?.[0]?.id || ''
  }
  formError.value = ''
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
    const { brand_id, ...rest } = form.value
    const payload = { ...rest, brands: rest.role === 'client' ? (brand_id ? [brand_id] : []) : [] }

    // Validate client role requires at least one brand
    if (payload.role === 'client' && payload.brands.length === 0) {
      formError.value = t('users.mustSelectBrands')
      submitting.value = false
      return
    }

    if (editing.value) {
      if (!payload.password) delete payload.password
      await editItem(editing.value.id, payload)
    } else {
      await addItem(payload)
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
  } catch (e) {
    // ignore
  }
  showDeleteModal.value = false
  deletingItem.value = null
}

</script>

<template>
  <div>
    <div class="flex items-center justify-between mb-6">
      <div>
        <h1 class="text-2xl font-bold text-surface-900">{{ t('users.title') }}</h1>
        <p class="mt-1 text-sm text-surface-500">{{ t('users.description') }}</p>
      </div>
      <Button @click="openAddForm">{{ t('users.addUser') }}</Button>
    </div>

    <div class="mb-4">
      <Input v-model="search" label="" :placeholder="t('users.searchPlaceholder')" />
    </div>

    <Card variant="bordered">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      <div v-else-if="items.length === 0" class="text-center py-12">
        <p class="text-surface-500">{{ t('users.noResults') }}</p>
      </div>
      <template v-else>
        <Table :columns="columns" :rows="items" :pagination="pagination" @page-change="fetchData" showVerticalBorder>
          <template #status="{ value }">
            <Badge :variant="value === 'active' ? 'success' : 'danger'" size="sm">{{ value === 'active' ? t('common.active') : t('common.inactive') }}</Badge>
          </template>
          <template #role="{ value }">
            <Badge variant="primary" size="sm">{{ value }}</Badge>
          </template>
          <template #actions="{ row }">
            <div class="flex items-center gap-1">
              <button @click="openEditForm(row)" class="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50 transition-colors cursor-pointer" :title="t('common.edit')">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>
              </button>
              <button @click="openDeleteModal(row)" class="p-1.5 rounded-lg text-red-600 hover:bg-red-50 transition-colors cursor-pointer" :title="t('common.delete')">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
              </button>
            </div>
          </template>
        </Table>
      </template>
    </Card>

    <Modal v-model="showForm" :title="editing ? t('users.editUser') : t('users.addUser')" size="md" contentClass="h-[80vh]" :closeOnOverlay="false">
      <div class="space-y-4">
        <div v-if="formError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{{ formError }}</div>
        <Input :model-value="form.name" @update:model-value="v => form.name = upper(v)" :label="t('users.fullName')" :placeholder="t('users.fullName')" required />
        <Input v-model="form.username" :label="t('users.username')" :placeholder="t('users.username')" required />
        <div class="relative">
          <Input v-if="!editing" v-model="form.password" :type="showPassword ? 'text' : 'password'" :label="t('users.password')" :placeholder="t('users.minChars')" required>
            <template #rightIcon>
              <button type="button" @click="showPassword = !showPassword" class="cursor-pointer text-surface-400 hover:text-surface-600">
                <svg v-if="!showPassword" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
              </button>
            </template>
          </Input>
          <Input v-else v-model="form.password" :type="showPassword ? 'text' : 'password'" :label="t('users.password')" :placeholder="t('users.keepPassword')">
            <template #rightIcon>
              <button type="button" @click="showPassword = !showPassword" class="cursor-pointer text-surface-400 hover:text-surface-600">
                <svg v-if="!showPassword" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>
                <svg v-else class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>
              </button>
            </template>
          </Input>
        </div>
        <Input :model-value="form.phone" @update:model-value="v => form.phone = upper(v)" :label="t('common.phone')" :placeholder="t('common.phone')" />
        <SearchableDropdown v-model="form.role" :options="roleOptions" :label="t('users.role')" :placeholder="t('users.role')" />
        <SearchableDropdown v-if="form.role === 'client'" v-model="form.brand_id" :options="brands" :label="t('users.brands')" :placeholder="t('common.selectBrand')" />
        <SearchableDropdown v-model="form.status" :options="statusOptions" :label="t('common.status')" :placeholder="t('common.status')" />
      </div>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showForm = false">{{ t('common.cancel') }}</Button>
          <Button :loading="submitting" @click="handleSubmit">{{ editing ? t('common.update') : t('common.create') }}</Button>
        </div>
      </template>
    </Modal>

    <Modal v-model="showDeleteModal" :title="t('users.deleteTitle')" size="sm" :closeOnOverlay="false">
      <p class="text-surface-700">{{ t('common.confirmDelete') }} <strong>{{ deletingItem?.name }}</strong>? {{ t('common.cannotUndo') }}</p>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showDeleteModal = false">{{ t('common.cancel') }}</Button>
          <Button variant="danger" @click="handleDelete">{{ t('common.delete') }}</Button>
        </div>
      </template>
    </Modal>
  </div>
</template>