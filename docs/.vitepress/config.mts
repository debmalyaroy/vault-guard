import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'

// https://vitepress.dev/reference/site-config
export default withMermaid(
  defineConfig({
    title: 'VaultGuard',
    description: 'Trust Infrastructure for Production AI Agents — 5-stage threat interception, blast radius mapping, and tamper-evident audit trails.',
    lang: 'en-US',

    // Base URL for GitHub Pages (replace with your repo name if not a user/org site)
    // base: '/vault-guard/',

    head: [
      ['link', { rel: 'icon', href: '/favicon.svg' }],
      ['meta', { name: 'theme-color', content: '#00ff41' }],
      ['meta', { name: 'og:title', content: 'VaultGuard — AI Agent Trust Infrastructure' }],
      ['meta', { name: 'og:description', content: '5-stage threat interception, blast radius mapping, and tamper-evident audit for production AI agents.' }],
    ],

    themeConfig: {
      logo: '/logo.svg',
      siteTitle: 'VaultGuard',

      nav: [
        { text: 'Home', link: '/' },
        { text: 'Architecture', link: '/ARCHITECTURE' },
        { text: 'Low-Level Design', link: '/LOW_LEVEL_DESIGN' },
        {
          text: 'Guides',
          items: [
            { text: 'Deployment Guide', link: '/USER_GUIDE_AND_DEPLOYMENT' },
            { text: 'Demo Script', link: '/DEMO_SCRIPT' },
            { text: 'Roadmap', link: '/ROADMAP' },
          ],
        },
        { text: 'GitHub', link: 'https://github.com/debmalyaroy/vault-guard', target: '_blank' },
      ],

      sidebar: [
        {
          text: 'Overview',
          items: [{ text: 'Introduction', link: '/' }],
        },
        {
          text: 'Design',
          items: [
            { text: 'Architecture (HLD)', link: '/ARCHITECTURE' },
            { text: 'Low-Level Design', link: '/LOW_LEVEL_DESIGN' },
          ],
        },
        {
          text: 'Operations',
          items: [
            { text: 'Deployment Guide', link: '/USER_GUIDE_AND_DEPLOYMENT' },
            { text: 'Demo Script', link: '/DEMO_SCRIPT' },
            { text: 'Roadmap', link: '/ROADMAP' },
          ],
        },
      ],

      socialLinks: [
        { icon: 'github', link: 'https://github.com/debmalyaroy/vault-guard' },
      ],

      footer: {
        message: 'Built with ❤️ for secure AI agent deployments.',
        copyright: 'Copyright © 2025 VaultGuard. MIT License.',
      },

      search: {
        provider: 'local',
      },

      editLink: {
        pattern: 'https://github.com/debmalyaroy/vault-guard/edit/develop/docs/:path',
        text: 'Edit this page on GitHub',
      },

      lastUpdated: {
        text: 'Updated at',
        formatOptions: {
          dateStyle: 'full',
          timeStyle: 'medium',
        },
      },
    },

    markdown: {
      lineNumbers: true,
    },

    // Mermaid config — matches the hacker terminal dark theme
    mermaid: {
      theme: 'dark',
      themeVariables: {
        darkMode: true,
        background: '#0d1117',
        primaryColor: '#00ff41',
        primaryTextColor: '#c9d1d9',
        primaryBorderColor: '#30363d',
        lineColor: '#00ff41',
        secondaryColor: '#161b22',
        tertiaryColor: '#21262d',
        noteBkgColor: '#161b22',
        noteTextColor: '#c9d1d9',
        actorBkg: '#161b22',
        actorBorder: '#00ff41',
        actorTextColor: '#c9d1d9',
        activationBorderColor: '#00ff41',
        sequenceNumberColor: '#00ff41',
        nodeBkg: '#161b22',
        nodeBorder: '#00ff41',
        clusterBkg: '#0d1117',
        titleColor: '#00ff41',
        edgeLabelBackground: '#161b22',
        fontSize: '14px',
      },
    },

    mermaidPlugin: {
      class: 'mermaid',
    },
  })
)
