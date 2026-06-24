import { ref, onMounted } from 'vue'

const ROOT_ID = 'vike-toolbar-root'
const ITEMS_ID = 'vike-toolbar-items'

export function useToolbarSlot() {
  const slot = ref(undefined) // PENDING on server + first client render
  onMounted(() => {
    const items = document.getElementById(ITEMS_ID)
    if (items) {
      slot.value = items
      return
    }
    if (!document.getElementById(ROOT_ID)) {
      slot.value = null
      return
    }
    // Toolbar installed but its panel hasn't portaled in yet -> wait, stay PENDING.
    const obs = new MutationObserver(() => {
      const node = document.getElementById(ITEMS_ID)
      if (node) {
        slot.value = node
        obs.disconnect()
      }
    })
    obs.observe(document.body, { childList: true, subtree: true })
  })
  return slot
}
