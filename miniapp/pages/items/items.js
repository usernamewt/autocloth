const auth = require('../../utils/auth')
const { api } = require('../../utils/api')
const { applyPageTheme } = require('../../utils/themeApply')

const COLOR_MAP = [
  [/白/, '#F3F3F3'], [/黑/, '#1F1F1F'], [/灰/, '#9CA3AF'],
  [/藏蓝|深蓝/, '#1E3A5F'], [/浅蓝/, '#93C5FD'], [/蓝/, '#3B82F6'],
  [/绿/, '#22C55E'], [/红/, '#EF4444'], [/粉/, '#F472B6'],
  [/橙/, '#F97316'], [/黄/, '#EAB308'], [/紫/, '#A855F7'],
  [/棕|褐/, '#92400E'], [/米|奶/, '#F5E6D0'], [/卡其|驼/, '#C4A472'],
  [/金/, '#D4AF37'], [/银/, '#B0B0B0'],
]

function resolveColor(name) {
  if (!name) return '#CCCCCC'
  const s = name.toLowerCase()
  for (const [re, hex] of COLOR_MAP) {
    if (re.test(s)) return hex
  }
  return '#CCCCCC'
}

function buildItems(raw) {
  return (raw || []).map((it) => ({
    ...it,
    colorDots: (it.taxonomy_color_labels || []).slice(0, 4).map((c) => ({
      label: c,
      color: resolveColor(c),
    })),
    displayName: it.name || it.taxonomy_type_label || it.type || '未命名',
    displayType: it.taxonomy_type_label || it.type || '',
    isProcessing: it.status === 'processing',
    showImage: !!(it.thumbnail_url || it.image_url),
    imgUrl: it.thumbnail_url || it.image_url || '',
  }))
}

Page({
  data: {
    pageStyle: '',
    items: [],
    leftItems: [],
    rightItems: [],
    loading: false,
    refreshing: false,
    search: '',
    activeTab: 'all',
    tabs: [
      { key: 'all', label: '全部' },
      { key: 'favorite', label: '⭐ 收藏' },
      { key: 'needs_wash', label: '🧺 待清洗' },
    ],
    hasProcessing: false,
    deletingId: '',
    total: 0,
  },

  _pollTimer: null,

  onLoad() {
    if (!auth.isAuthenticated()) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    this.load()
  },

  onShow() {
    applyPageTheme(this)
    if (auth.isAuthenticated()) this.load()
  },

  onUnload() {
    this._stopPoll()
  },

  // ── 数据加载 ──
  async load(silent = false) {
    if (!silent) this.setData({ loading: true })
    const { search, activeTab } = this.data
    const params = ['page_size=50', 'page=1']
    if (search.trim()) params.push('search=' + encodeURIComponent(search.trim()))
    if (activeTab === 'favorite') params.push('favorite=true')
    if (activeTab === 'needs_wash') params.push('needs_wash=true')

    try {
      const res = await api.get('/items?' + params.join('&'))
      const items = buildItems(res.items || [])
      const hasProcessing = items.some((i) => i.isProcessing)
      const leftItems = items.filter((_, i) => i % 2 === 0)
      const rightItems = items.filter((_, i) => i % 2 === 1)
      this.setData({ items, leftItems, rightItems, total: res.total || 0, hasProcessing, loading: false, refreshing: false })
      hasProcessing ? this._startPoll() : this._stopPoll()
    } catch (e) {
      this.setData({ loading: false, refreshing: false })
      wx.showToast({ title: e.message || '加载失败', icon: 'none' })
    }
  },

  // ── 下拉刷新 ──
  onRefresh() {
    this.setData({ refreshing: true })
    this.load()
  },

  // ── 搜索 ──
  onSearchInput(e) {
    this.setData({ search: e.detail.value })
  },

  onSearchConfirm() {
    this.load()
  },

  onClearSearch() {
    this.setData({ search: '' }, () => this.load())
  },

  // ── Tab 切换 ──
  onTabTap(e) {
    const key = e.currentTarget.dataset.key
    if (key === this.data.activeTab) return
    this.setData({ activeTab: key }, () => this.load())
  },

  // ── 跳转详情 ──
  onItemTap(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({ url: `/pages/item-detail/item-detail?id=${id}` })
  },

  // ── 删除 ──
  onDeleteTap(e) {
    const { id, name } = e.currentTarget.dataset
    wx.showModal({
      title: '删除衣物',
      content: `确认删除「${name || '该衣物'}」？此操作不可恢复。`,
      confirmText: '删除',
      confirmColor: '#c0392b',
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ deletingId: id })
        try {
          await api.delete(`/items/${id}`)
          this.setData({
            items: this.data.items.filter((i) => i.id !== id),
            deletingId: '',
          })
          wx.showToast({ title: '已删除', icon: 'success' })
        } catch (e) {
          this.setData({ deletingId: '' })
          wx.showToast({ title: e.message || '删除失败', icon: 'none' })
        }
      },
    })
  },

  // ── 录入新衣物 ──
  goAddItem() {
    wx.navigateTo({ url: '/pages/item-create/item-create' })
  },

  // ── 轮询处理中的衣物 ──
  _startPoll() {
    if (this._pollTimer) return
    this._pollTimer = setInterval(() => this.load(true), 5000)
  },

  _stopPoll() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
      this._pollTimer = null
    }
  },
})
