<script setup>
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useMasterData } from '@/composables/useMasterData'
import { useDebounce } from '@/composables/useDebounce'
import { Button, Card, Table, Badge, Input, Modal } from 'ui-assets'

const { t } = useI18n()

const router = useRouter()

const search = ref('')
const { debounce } = useDebounce(500)

const { items, loading, pagination, fetchData, addItem, editItem, deleteItem } = useMasterData('/tailors', () => ({ search: search.value }))

watch(search, () => debounce(() => fetchData(1)))

const columns = [
  { key: 'name', label: t('common.name') },
  { key: 'phone', label: t('common.phone') },
  { key: 'address', label: t('common.address') },
  { key: 'status', label: t('common.status') },
  { key: 'actions', label: t('common.actions') },
]

const showForm = ref(false)
const showDeleteModal = ref(false)
const editing = ref(null)
const deletingItem = ref(null)
const formError = ref('')
const submitting = ref(false)

const form = ref({ name: '', phone: '', address: '', status: 'active' })

function upper(v) { return typeof v === 'string' ? v.toUpperCase() : v }

function openAddForm() {
  editing.value = null
  form.value = { name: '', phone: '', address: '', status: 'active' }
  formError.value = ''
  showForm.value = true
}

function openEditForm(item) {
  editing.value = item
  form.value = { name: item.name, phone: item.phone || '', address: item.address || '', status: item.status }
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

function navToDetail(row) {
  router.push({ name: 'tailor-detail', params: { id: row.id } })
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
        <h1 class="text-2xl font-bold text-surface-900">{{ t('tailors.title') }}</h1>
        <p class="mt-1 text-sm text-surface-500">{{ t('tailors.description') }}</p>
      </div>
      <Button @click="openAddForm">{{ t('tailors.addTailor') }}</Button>
    </div>

    <div class="mb-4">
      <Input v-model="search" label="" :placeholder="t('tailors.searchPlaceholder')" />
    </div>

    <Card variant="bordered">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      <div v-else-if="items.length === 0" class="text-center py-12">
        <p class="text-surface-500">{{ t('tailors.searchPlaceholder') }}</p>
      </div>
      <template v-else>
        <Table :columns="columns" :rows="items" :pagination="pagination" @page-change="fetchData" clickable @row-click="navToDetail">
          <template #status="{ value }">
            <Badge :variant="value === 'active' ? 'success' : 'danger'" size="sm">{{ value === 'active' ? t('common.active') : t('common.inactive') }}</Badge>
          </template>
          <template #actions="{ row }">
            <div class="flex items-center gap-1" @click.stop>
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

    <Modal v-model="showForm" :title="editing ? t('tailors.editTailor') : t('tailors.addTailor')" size="md" contentClass="h-[80vh]" :closeOnOverlay="false">
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div v-if="formError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{{ formError }}</div>
        <Input :model-value="form.name" @update:model-value="v => form.name = upper(v)" :label="t('common.name')" :placeholder="t('tailors.tailorName')" required />
        <Input :model-value="form.phone" @update:model-value="v => form.phone = upper(v)" :label="t('common.phone')" :placeholder="t('tailors.phoneNumber')" />
        <Input :model-value="form.address" @update:model-value="v => form.address = upper(v)" :label="t('common.address')" type="textarea" :placeholder="t('tailors.tailorAddress')" />
        <div class="space-y-1">
          <label class="block text-sm font-medium text-surface-700">{{ t('common.status') }}</label>
          <select v-model="form.status" class="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500">
            <option value="active">{{ t('common.active') }}</option>
            <option value="inactive">{{ t('common.inactive') }}</option>
          </select>
        </div>
      </form>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showForm = false">{{ t('common.cancel') }}</Button>
          <Button :loading="submitting" @click="handleSubmit">{{ editing ? t('common.update') : t('common.create') }}</Button>
        </div>
      </template>
    </Modal>

    <Modal v-model="showDeleteModal" :title="t('tailors.deleteTitle')" size="sm" :closeOnOverlay="false">
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
