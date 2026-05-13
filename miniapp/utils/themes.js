/**
 * utils/themes.js — 5套主题定义
 *
 * warm     : 暖香槟 × 拿铁棕（当前默认）
 * minimal  : 简约白墨（Web端风格）
 * midnight : 午夜靛蓝（暗黑奢华）
 * rose     : 玫瑰石英（浪漫优雅）
 * olive    : 橄榄黑金（Bottega Veneta风）
 */

const THEMES = {
  warm: {
    name: '暖香槟',
    desc: '温暖奢华',
    navBg: '#F5EDE0',
    navFront: '#000000',
    tabBg: '#F5EDE0',
    tabColor: '#8a7060',
    tabSelected: '#5c3d2e',
    preview: ['#F5EDE0', '#5C3D2E', '#B8986B'],
    vars: {
      '--color-bg': '#fdfaf7',
      '--color-bg-subtle': '#f5ede0',
      '--color-nav': '#f5ede0',
      '--color-fg': '#2c1a0e',
      '--color-muted': '#ede3d8',
      '--color-muted-fg': '#8a7060',
      '--color-border': '#dccfbf',
      '--color-primary': '#5c3d2e',
      '--color-primary-fg': '#fdfaf7',
      '--color-accent': '#b8986b',
      '--color-card': '#fdfaf7',
      '--color-destructive': '#c0392b',
      '--color-success': '#4a7c59',
    },
  },

  minimal: {
    name: '简约白墨',
    desc: '现代极简',
    navBg: '#FFFFFF',
    navFront: '#000000',
    tabBg: '#FFFFFF',
    tabColor: '#71717a',
    tabSelected: '#18181b',
    preview: ['#FFFFFF', '#18181B', '#71717A'],
    vars: {
      '--color-bg': '#ffffff',
      '--color-bg-subtle': '#f8f8f8',
      '--color-nav': '#ffffff',
      '--color-fg': '#09090b',
      '--color-muted': '#f4f4f5',
      '--color-muted-fg': '#71717a',
      '--color-border': '#e4e4e7',
      '--color-primary': '#18181b',
      '--color-primary-fg': '#ffffff',
      '--color-accent': '#71717a',
      '--color-card': '#ffffff',
      '--color-destructive': '#dc2626',
      '--color-success': '#16a34a',
    },
  },

  midnight: {
    name: '午夜靛蓝',
    desc: '暗夜奢华',
    navBg: '#0D0D1E',
    navFront: '#ffffff',
    tabBg: '#0D0D1E',
    tabColor: '#6060a0',
    tabSelected: '#c8a96e',
    preview: ['#0D0D1E', '#C8A96E', '#9B7FC8'],
    vars: {
      '--color-bg': '#080812',
      '--color-bg-subtle': '#0d0d1e',
      '--color-nav': '#0d0d1e',
      '--color-fg': '#e8e8f0',
      '--color-muted': '#1a1a2e',
      '--color-muted-fg': '#7070a0',
      '--color-border': '#252540',
      '--color-primary': '#c8a96e',
      '--color-primary-fg': '#0d0d1e',
      '--color-accent': '#9b7fc8',
      '--color-card': '#12121f',
      '--color-destructive': '#f87171',
      '--color-success': '#4ade80',
    },
  },

  rose: {
    name: '玫瑰石英',
    desc: '浪漫优雅',
    navBg: '#FBF0F2',
    navFront: '#000000',
    tabBg: '#FBF0F2',
    tabColor: '#9b6b78',
    tabSelected: '#8b2942',
    preview: ['#FBF0F2', '#8B2942', '#D4A0A8'],
    vars: {
      '--color-bg': '#fdf5f6',
      '--color-bg-subtle': '#fbf0f2',
      '--color-nav': '#fbf0f2',
      '--color-fg': '#2d0e18',
      '--color-muted': '#f0dde0',
      '--color-muted-fg': '#9b6b78',
      '--color-border': '#e8c8d0',
      '--color-primary': '#8b2942',
      '--color-primary-fg': '#fdf5f6',
      '--color-accent': '#d4a0a8',
      '--color-card': '#fdf5f6',
      '--color-destructive': '#be123c',
      '--color-success': '#4a7c59',
    },
  },

  olive: {
    name: '橄榄黑金',
    desc: '低调奢华',
    navBg: '#1A1A12',
    navFront: '#ffffff',
    tabBg: '#1A1A12',
    tabColor: '#807862',
    tabSelected: '#c8a96e',
    preview: ['#1A1A12', '#C8A96E', '#8B7355'],
    vars: {
      '--color-bg': '#0f0f0a',
      '--color-bg-subtle': '#1a1a12',
      '--color-nav': '#1a1a12',
      '--color-fg': '#e8e8c8',
      '--color-muted': '#252518',
      '--color-muted-fg': '#807862',
      '--color-border': '#2a2a1a',
      '--color-primary': '#c8a96e',
      '--color-primary-fg': '#0f0f0a',
      '--color-accent': '#8b7355',
      '--color-card': '#1c1c14',
      '--color-destructive': '#f87171',
      '--color-success': '#a3e635',
    },
  },
}

function getTheme(key) {
  return THEMES[key] || THEMES.warm
}

function getPageStyle(key) {
  const theme = getTheme(key)
  const keys = Object.keys(theme.vars)
  const parts = []
  for (let i = 0; i < keys.length; i++) {
    parts.push(keys[i] + ':' + theme.vars[keys[i]])
  }
  return parts.join(';')
}

function getThemeList() {
  const keys = Object.keys(THEMES)
  return keys.map(function(k) {
    return Object.assign({ key: k }, THEMES[k])
  })
}

module.exports = { THEMES, getTheme, getPageStyle, getThemeList }
