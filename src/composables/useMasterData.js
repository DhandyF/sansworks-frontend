import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'

export function useMasterData(endpoint) {
  const { loading, error, paginate, create, update, remove } = useApi()
  const items = ref([])
  const currentPage = ref(1)
  const perPage = ref(15)
  const totalItems = ref(0)
  const lastPage = ref(1)

  async function fetchData(page = 1) {
    currentPage.value = page
    const res = await paginate(endpoint, page, perPage.value)
    items.value = res.data
    totalItems.value = res.total
    lastPage.value = res.last_page
    perPage.value = res.per_page
  }

  async function addItem(data) {
    const res = await create(endpoint, data)
    await fetchData(currentPage.value)
    return res
  }

  async function editItem(id, data) {
    const res = await update(endpoint, id, data)
    await fetchData(currentPage.value)
    return res
  }

  async function deleteItem(id) {
    await remove(endpoint, id)
    await fetchData(1)
  }

  onMounted(() => fetchData(1))

  return {
    items, loading, error, currentPage, perPage, totalItems, lastPage,
    fetchData, addItem, editItem, deleteItem,
  }
}