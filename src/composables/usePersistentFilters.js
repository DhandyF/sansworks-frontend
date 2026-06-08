import { ref, watch } from 'vue'

/**
 * Composable for managing persistent filters using localStorage
 * @param {string} storageKey - Unique key for storing filters in localStorage
 * @param {object} initialFilters - Initial filter values
 * @returns {object} Reactive filter refs
 */
export function usePersistentFilters(storageKey, initialFilters = {}) {
  // Create refs for each filter with initial or stored values
  const filters = {}
  const stored = localStorage.getItem(storageKey)

  try {
    const parsedStored = stored ? JSON.parse(stored) : {}
    for (const [key, initialValue] of Object.entries(initialFilters)) {
      // Use stored value if available, otherwise use initial value
      filters[key] = ref(parsedStored[key] !== undefined ? parsedStored[key] : initialValue)
    }
  } catch (e) {
    // If parsing fails, use initial values
    for (const [key, initialValue] of Object.entries(initialFilters)) {
      filters[key] = ref(initialValue)
    }
  }

  // Watch all filters and persist changes to localStorage
  const filterKeys = Object.keys(filters)
  const filterValues = Object.values(filters)

  // Watch each filter individually to ensure reactivity
  filterValues.forEach((filterRef, index) => {
    watch(
      filterRef,
      () => {
        const toStore = {}
        filterKeys.forEach((key, i) => {
          toStore[key] = filterValues[i].value
        })
        localStorage.setItem(storageKey, JSON.stringify(toStore))
      },
      { deep: true }
    )
  })

  return filters
}
