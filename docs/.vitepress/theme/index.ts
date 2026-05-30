import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import './style.css'
import MermaidEnhancer from '../components/MermaidEnhancer.vue'
import PanelToggles from '../components/PanelToggles.vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'layout-bottom': () => [h(MermaidEnhancer), h(PanelToggles)],
    })
  },
}
