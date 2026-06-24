import { usePageContext } from 'vike-vue/usePageContext'
import { computed } from 'vue'

export function useUser() {
  const pageContext = usePageContext()
  return computed(() => pageContext.user ?? null)
}
