import { ref, onMounted } from 'vue'
import { useApi } from '@/composables/useApi'

export function useMasterData(endpoint, buildParams = null, options = {}) {
  const { perPage: perPageDefault = 15, autoFetch = true } = typeof options === 'boolean' ? { autoFetch: options } : options
  const { loading, error, request, create, update, remove } = useApi()
  const items = ref([])
  const currentPage = ref(1)
  const perPage = ref(perPageDefault)
  const totalItems = ref(0)
  const lastPage = ref(1)
  const meta = ref({})

  const pagination = ref({
    currentPage: 1,
    lastPage: 1,
    total: 0,
    from: 0,
    to: 0,
    perPage: perPageDefault,
  })

  async function fetchData(page = 1) {
    currentPage.value = page
    let url = `${endpoint}?page=${page}&per_page=${perPage.value}`
    if (buildParams) {
      const params = buildParams()
      for (const [key, value] of Object.entries(params)) {
        if (value !== '' && value !== null && value !== undefined) {
          url += `&${key}=${encodeURIComponent(value)}`
        }
      }
    }
    const res = await request(url)
    
    items.value = res.data
    const m = res.meta || {}
    meta.value = m
    totalItems.value = m.total || 0
    lastPage.value = m.last_page || 1
    perPage.value = m.per_page || perPageDefault
    pagination.value = {
      currentPage: m.current_page || 1,
      lastPage: m.last_page || 1,
      total: m.total || 0,
      from: m.from || (m.total > 0 ? ((m.current_page || 1) - 1) * (m.per_page || perPageDefault) + 1 : 0),
      to: m.to || Math.min((m.current_page || 1) * (m.per_page || perPageDefault), m.total || 0),
      perPage: m.per_page || perPageDefault,
    }
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

  if (autoFetch) {
    onMounted(() => fetchData(1))
  }

  return {
    items, loading, error, currentPage, perPage, totalItems, lastPage,
    pagination, fetchData, addItem, editItem, deleteItem,
  }
}