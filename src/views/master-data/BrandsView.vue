<script setup>
import { ref } from 'vue'
import { useMasterData } from '@/composables/useMasterData'
import { Button, Card, Table, Badge, Input, Modal } from 'ui-assets'

const { items, loading, pagination, fetchData, addItem, editItem, deleteItem } = useMasterData('/brands')

const columns = [
  { key: 'name', label: 'Name' },
  { key: 'phone', label: 'Phone' },
  { key: 'address', label: 'Address' },
  { key: 'status', label: 'Status' },
  { key: 'actions', label: 'Actions' },
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
        <h1 class="text-2xl font-bold text-surface-900">Brands</h1>
        <p class="mt-1 text-sm text-surface-500">Manage brand information</p>
      </div>
      <Button @click="openAddForm">+ Add Brand</Button>
    </div>

    <Card variant="bordered">
      <div v-if="loading" class="flex items-center justify-center py-12">
        <svg class="animate-spin h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
      <div v-else-if="items.length === 0" class="text-center py-12">
        <p class="text-surface-500">No brands found</p>
      </div>
      <template v-else>
        <Table :columns="columns" :rows="items" :pagination="pagination" @page-change="fetchData">
          <template #status="{ value }">
            <Badge :variant="value === 'active' ? 'success' : 'danger'" size="sm">{{ value }}</Badge>
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

    <Modal v-model="showForm" :title="editing ? 'Edit Brand' : 'Add Brand'" size="md">
      <form @submit.prevent="handleSubmit" class="space-y-4">
        <div v-if="formError" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{{ formError }}</div>
        <Input :model-value="form.name" @update:model-value="v => form.name = upper(v)" label="Name" placeholder="Brand name" required />
        <Input :model-value="form.phone" @update:model-value="v => form.phone = upper(v)" label="Phone" placeholder="Phone number" />
        <Input :model-value="form.address" @update:model-value="v => form.address = upper(v)" label="Address" type="textarea" placeholder="Brand address" />
        <div class="space-y-1">
          <label class="block text-sm font-medium text-surface-700">Status</label>
          <select v-model="form.status" class="w-full rounded-lg border border-surface-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
      </form>
      <template #footer>
        <div class="flex justify-end gap-3">
          <Button variant="outline" @click="showForm = false">Cancel</Button>
          <Button :loading="submitting" @click="handleSubmit">{{ editing ? 'Update' : 'Create' }}</Button>
        </div>
      </template>
    </Modal>

    <Modal v-model="showDeleteModal" title="Delete Brand" size="sm">
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