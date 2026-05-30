<template>
  <div style="display:none" aria-hidden="true" />
</template>

<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()

function enhanceAll() {
  // Allow mermaid plugin to finish rendering first
  setTimeout(() => {
    document.querySelectorAll<HTMLElement>('.vp-doc .mermaid:not([data-vg-enhanced])').forEach(wrapDiagram)
  }, 600)
}

function wrapDiagram(el: HTMLElement) {
  el.setAttribute('data-vg-enhanced', '1')

  const container = document.createElement('div')
  container.className = 'vg-mermaid-container'

  const toolbar = document.createElement('div')
  toolbar.className = 'vg-mermaid-toolbar'
  toolbar.innerHTML = `
    <span class="vg-mermaid-label">DIAGRAM</span>
    <div class="vg-mermaid-controls">
      <button class="vg-mermaid-btn" data-action="zoom-in"  title="Zoom in">＋</button>
      <button class="vg-mermaid-btn" data-action="zoom-out" title="Zoom out">－</button>
      <button class="vg-mermaid-btn" data-action="reset"    title="Reset zoom">⟳</button>
      <button class="vg-mermaid-btn" data-action="modal"    title="Open fullscreen">⛶</button>
    </div>
  `

  let scale = 1

  const scaleEl = () => {
    el.style.transform = `scale(${scale})`
    el.style.transformOrigin = 'top center'
    // Expand container height so content doesn't clip
    const svgH = (el.querySelector('svg')?.getBoundingClientRect().height ?? 200) * scale
    container.style.minHeight = `${svgH + 8}px`
  }

  toolbar.addEventListener('click', (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-action]')
    if (!btn) return
    const action = btn.dataset.action!
    if (action === 'zoom-in')  { scale = Math.min(+(scale + 0.2).toFixed(1), 3.0); scaleEl() }
    if (action === 'zoom-out') { scale = Math.max(+(scale - 0.2).toFixed(1), 0.3); scaleEl() }
    if (action === 'reset')    { scale = 1; el.style.transform = ''; container.style.minHeight = '' }
    if (action === 'modal')    { openModal(el) }
  })

  el.parentNode!.insertBefore(container, el)
  container.appendChild(toolbar)
  container.appendChild(el)
}

function openModal(origEl: HTMLElement) {
  const overlay = document.createElement('div')
  overlay.className = 'vg-modal-overlay'
  overlay.addEventListener('click', (e: MouseEvent) => {
    if (e.target === overlay) overlay.remove()
  })

  const box = document.createElement('div')
  box.className = 'vg-modal-box'

  const header = document.createElement('div')
  header.className = 'vg-modal-header'

  let mz = 1
  const clone = origEl.cloneNode(true) as HTMLElement
  clone.removeAttribute('data-vg-enhanced')
  clone.style.transform = ''

  header.innerHTML = `
    <span class="vg-modal-title">DIAGRAM VIEWER</span>
    <div class="vg-modal-controls">
      <button class="vg-mermaid-btn" data-modal="zoom-in">＋</button>
      <button class="vg-mermaid-btn" data-modal="zoom-out">－</button>
      <button class="vg-mermaid-btn" data-modal="reset">⟳</button>
      <button class="vg-mermaid-btn vg-close-btn" data-modal="close">✕ CLOSE</button>
    </div>
  `

  const body = document.createElement('div')
  body.className = 'vg-modal-body'
  body.appendChild(clone)

  header.addEventListener('click', (e: MouseEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-modal]')
    if (!btn) return
    const a = btn.dataset.modal!
    if (a === 'zoom-in')  { mz = Math.min(+(mz + 0.2).toFixed(1), 4.0); clone.style.transform = `scale(${mz})`; clone.style.transformOrigin = 'top center' }
    if (a === 'zoom-out') { mz = Math.max(+(mz - 0.2).toFixed(1), 0.2); clone.style.transform = `scale(${mz})`; clone.style.transformOrigin = 'top center' }
    if (a === 'reset')    { mz = 1; clone.style.transform = '' }
    if (a === 'close')    { overlay.remove() }
  })

  document.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Escape') overlay.remove()
  }, { once: true })

  box.appendChild(header)
  box.appendChild(body)
  overlay.appendChild(box)
  document.body.appendChild(overlay)
}

onMounted(enhanceAll)
watch(() => route.path, enhanceAll)
</script>
