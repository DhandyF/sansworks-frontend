import { ref, watch } from 'vue'

export function useDebounce(delay = 300) {
  const timeout = ref(null)

  function debounce(fn) {
    if (timeout.value) clearTimeout(timeout.value)
    timeout.value = setTimeout(fn, delay)
  }

  return { debounce }
}