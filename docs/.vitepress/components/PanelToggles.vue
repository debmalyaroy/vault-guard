<template>
  <div style="display:none" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onMounted, watch, onUnmounted } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()

let sidebarOpen = true
let asideOpen = true

let sidebarBtn: HTMLButtonElement | null = null
let asideBtn: HTMLButtonElement | null = null

function createBtn(id: string, extraClass: string): HTMLButtonElement {
  const btn = document.createElement('button')
  btn.id = id
  btn.className = 'vg-pt-btn ' + extraClass
  return btn
}

function syncSidebar() {
  if (!sidebarBtn) return
  sidebarBtn.innerHTML = sidebarOpen ? '◂' : '▸'
  sidebarBtn.title = sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'
  document.documentElement.classList.toggle('vg-sidebar-closed', !sidebarOpen)
}

function syncAside() {
  if (!asideBtn) return
  asideBtn.innerHTML = asideOpen ? '▸' : '◂'
  asideBtn.title = asideOpen ? 'Collapse contents' : 'Expand contents'
  document.documentElement.classList.toggle('vg-aside-closed', !asideOpen)
}

function injectToggles() {
  // ── Sidebar button ─────────────────────────────────────────────
  if (!document.getElementById('vg-pt-sidebar')) {
    const sidebar = document.querySelector('.VPSidebar')
    if (sidebar) {
      sidebarBtn = createBtn('vg-pt-sidebar', 'vg-pt-sidebar-btn')
      sidebarBtn.addEventListener('click', () => {
        sidebarOpen = !sidebarOpen
        syncSidebar()
      })
      document.body.appendChild(sidebarBtn)
      syncSidebar()
    }
  } else {
    sidebarBtn = document.getElementById('vg-pt-sidebar') as HTMLButtonElement
  }

  // ── Aside button ───────────────────────────────────────────────
  if (!document.getElementById('vg-pt-aside')) {
    // Only create aside button if aside element exists on this page
    const aside = document.querySelector('.VPDoc .aside')
    if (aside) {
      asideBtn = createBtn('vg-pt-aside', 'vg-pt-aside-btn')
      asideBtn.addEventListener('click', () => {
        asideOpen = !asideOpen
        syncAside()
      })
      document.body.appendChild(asideBtn)
      syncAside()
    }
  } else {
    asideBtn = document.getElementById('vg-pt-aside') as HTMLButtonElement
  }
}

function handleKeyboard(e: KeyboardEvent) {
  // Alt+[ toggles sidebar, Alt+] toggles aside
  if (e.altKey && e.key === '[') {
    sidebarOpen = !sidebarOpen
    syncSidebar()
  }
  if (e.altKey && e.key === ']') {
    asideOpen = !asideOpen
    syncAside()
  }
}

onMounted(() => {
  setTimeout(injectToggles, 500)
  document.addEventListener('keydown', handleKeyboard)
})

watch(() => route.path, () => {
  setTimeout(() => {
    // The aside appears/disappears per page — re-check
    if (!document.getElementById('vg-pt-aside')) {
      const aside = document.querySelector('.VPDoc .aside')
      if (aside && !asideBtn) {
        injectToggles()
      }
    }
    // Re-apply collapsed state after navigation
    document.documentElement.classList.toggle('vg-sidebar-closed', !sidebarOpen)
    document.documentElement.classList.toggle('vg-aside-closed', !asideOpen)
  }, 500)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyboard)
})
</script>
