const auth = require('../../utils/auth')
const { api } = require('../../utils/api')
const { applyPageTheme } = require('../../utils/themeApply')

const BASIC_KEYS = ['garment_type', 'color', 'season', 'scene', 'style']

function resolveSwatchColor(keyName, displayName) {
  const s = (keyName + '|' + displayName).toLowerCase()
  if (/white|白/.test(s)) return '#F3F3F3'
  if (/black|黑/.test(s)) return '#1F1F1F'
  if (/gr[ae]y|灰/.test(s)) return '#9CA3AF'
  if (/navy|藏蓝|深蓝/.test(s)) return '#1E3A5F'
  if (/light.?blue|浅蓝/.test(s)) return '#93C5FD'
  if (/blue|蓝/.test(s)) return '#3B82F6'
  if (/green|绿/.test(s)) return '#22C55E'
  if (/red|红/.test(s)) return '#EF4444'
  if (/pink|粉/.test(s)) return '#F472B6'
  if (/orange|橙/.test(s)) return '#F97316'
  if (/yellow|黄/.test(s)) return '#EAB308'
  if (/purple|紫/.test(s)) return '#A855F7'
  if (/brown|棕|褐/.test(s)) return '#92400E'
  if (/beige|米白|米色|奶/.test(s)) return '#F5E6D0'
  if (/khaki|卡其|驼/.test(s)) return '#C4A472'
  if (/gold|金/.test(s)) return '#D4AF37'
  if (/silver|银/.test(s)) return '#B0B0B0'
  return '#D1D5DB'
}

function flatTerms(terms, depth) {
  depth = depth || 0
  const result = []
  for (let i = 0; i < (terms || []).length; i++) {
    const t = terms[i]
    result.push({ id: t.id, key_name: t.key_name, display_name: t.display_name, depth: depth })
    if (t.children && t.children.length > 0) {
      const sub = flatTerms(t.children, depth + 1)
      for (let j = 0; j < sub.length; j++) result.push(sub[j])
    }
  }
  return result
}

function buildGroups(tree, selectedIds) {
  const idSet = {}
  for (let i = 0; i < selectedIds.length; i++) idSet[selectedIds[i]] = true
  return (tree || []).map(function(g) {
    return {
      id: g.id,
      key_name: g.key_name,
      display_name: g.display_name,
      is_color: g.key_name === 'color',
      terms: flatTerms(g.terms).map(function(t) {
        return Object.assign({}, t, {
          selected: !!idSet[t.id],
          swatchColor: g.key_name === 'color' ? resolveSwatchColor(t.key_name, t.display_name) : '',
        })
      }),
    }
  })
}

function buildTagList(tags) {
  if (!tags) return []
  if (Array.isArray(tags)) return tags.map(String)
  if (typeof tags === 'object') {
    const result = []
    const keys = Object.keys(tags)
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i], v = tags[k]
      if (Array.isArray(v)) { for (let j = 0; j < v.length; j++) result.push(k + ': ' + v[j]) }
      else if (v !== null && v !== undefined && v !== '') result.push(k + ': ' + v)
    }
    return result
  }
  return []
}

Page({
  data: {
    pageStyle: '',
    id: '',
    item: null,
    loading: true,
    error: '',
    statusLabel: '',
    statusClass: '',
    tagList: [],
    colorSwatches: [],
    basicGroups: [],
    advancedGroups: [],
    selectedTermIds: [],
    showAdvanced: false,
    savingTaxonomy: false,
    aiClassifying: false,
    taxonomyMsg: '',
    saving: false,
    wearing: false,
    deleting: false,
    nameValue: '',
    brandValue: '',
    notesValue: '',
    fieldSaving: '',
  },

  _pollTimer: null,
  _treeCache: [],

  onLoad(options) {
    if (!auth.isAuthenticated()) { wx.reLaunch({ url: '/pages/login/login' }); return }
    applyPageTheme(this)
    const id = options.id || ''
    this.setData({ id })
    this.load(id)
    this.loadTaxonomy(id)
  },

  onUnload() { this._stopPoll() },

  async load(id) {
    if (!id) return
    this.setData({ loading: true, error: '' })
    try {
      const item = await api.get('/items/' + id)
      this._applyItem(item)
    } catch (e) {
      this.setData({ loading: false, error: e.message || '加载失败' })
    }
  },

  _applyItem(item) {
    const statusMap = { ready: '就绪', processing: '处理中', error: '失败' }
    const statusClassMap = { ready: 'ready', processing: 'processing', error: 'error' }
    this.setData({
      item,
      loading: false,
      statusLabel: statusMap[item.status] || item.status,
      statusClass: statusClassMap[item.status] || '',
      tagList: buildTagList(item.tags),
      nameValue: item.name || '',
      brandValue: item.brand || '',
      notesValue: item.notes || '',
    })
    item.status === 'processing' ? this._startPoll(item.id) : this._stopPoll()
  },

  async loadTaxonomy(id) {
    try {
      const [tree, assigned] = await Promise.all([
        api.get('/taxonomy/tree'),
        api.get('/items/' + id + '/taxonomy'),
      ])
      this._treeCache = tree || []
      const ids = (assigned || []).map(function(t) { return t.term_id })
      this._applyTaxonomy(ids)
    } catch (e) { console.warn('taxonomy', e.message) }
  },

  _applyTaxonomy(selectedTermIds) {
    const tree = this._treeCache
    const groups = buildGroups(tree, selectedTermIds)
    const idSet = {}
    for (let i = 0; i < selectedTermIds.length; i++) idSet[selectedTermIds[i]] = true
    const colorGroup = groups.find(function(g) { return g.key_name === 'color' })
    const colorSwatches = colorGroup ? colorGroup.terms.filter(function(t) { return idSet[t.id] }) : []
    const basicGroups = groups.filter(function(g) { return BASIC_KEYS.indexOf(g.key_name) >= 0 && g.key_name !== 'color' })
    const advancedGroups = groups.filter(function(g) { return BASIC_KEYS.indexOf(g.key_name) < 0 })
    this.setData({ selectedTermIds, colorSwatches, basicGroups, advancedGroups })
  },

  onToggleTerm(e) {
    const termId = e.currentTarget.dataset.id
    const ids = this.data.selectedTermIds.slice()
    const idx = ids.indexOf(termId)
    if (idx >= 0) ids.splice(idx, 1)
    else ids.push(termId)
    this._applyTaxonomy(ids)
  },

  async onSaveTaxonomy() {
    this.setData({ savingTaxonomy: true, taxonomyMsg: '' })
    try {
      await api.put('/items/' + this.data.id + '/taxonomy', { term_ids: this.data.selectedTermIds })
      this.setData({ taxonomyMsg: '✓ 分类已保存' })
      setTimeout(() => this.setData({ taxonomyMsg: '' }), 2000)
    } catch (e) {
      this.setData({ taxonomyMsg: '保存失败: ' + e.message })
    } finally {
      this.setData({ savingTaxonomy: false })
    }
  },

  async onAiClassify() {
    this.setData({ aiClassifying: true, taxonomyMsg: '' })
    try {
      await api.post('/items/' + this.data.id + '/ai-classify')
      const assigned = await api.get('/items/' + this.data.id + '/taxonomy')
      const ids = (assigned || []).map(function(t) { return t.term_id })
      this._applyTaxonomy(ids)
      this.setData({ taxonomyMsg: '✓ AI 分类完成' })
      setTimeout(() => this.setData({ taxonomyMsg: '' }), 3000)
    } catch (e) {
      this.setData({ taxonomyMsg: 'AI 失败: ' + e.message })
    } finally {
      this.setData({ aiClassifying: false })
    }
  },

  toggleAdvanced() { this.setData({ showAdvanced: !this.data.showAdvanced }) },

  // ── 内联字段编辑（blur 自动保存）──
  onNameInput(e) { this.setData({ nameValue: e.detail.value }) },
  onBrandInput(e) { this.setData({ brandValue: e.detail.value }) },
  onNotesInput(e) { this.setData({ notesValue: e.detail.value }) },

  async onNameBlur() { await this._saveField({ name: this.data.nameValue.trim() || null }) },
  async onBrandBlur() { await this._saveField({ brand: this.data.brandValue.trim() || null }) },
  async onNotesBlur() { await this._saveField({ notes: this.data.notesValue.trim() || null }) },

  async _saveField(patch) {
    const { item } = this.data
    if (!item) return
    this.setData({ fieldSaving: Object.keys(patch)[0] })
    try {
      const updated = await api.patch('/items/' + item.id, patch)
      this._applyItem(updated)
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
    finally { this.setData({ fieldSaving: '' }) }
  },

  async onToggleFavorite() {
    const { item, saving } = this.data
    if (!item || saving) return
    this.setData({ saving: true })
    try {
      const updated = await api.patch('/items/' + item.id, { favorite: !item.favorite })
      this._applyItem(updated)
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
    finally { this.setData({ saving: false }) }
  },

  async onWear() {
    const { item, wearing } = this.data
    if (!item || wearing) return
    this.setData({ wearing: true })
    try {
      const updated = await api.post('/items/' + item.id + '/wear')
      this._applyItem(updated)
      wx.showToast({ title: '已记录穿着 +1', icon: 'success' })
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
    finally { this.setData({ wearing: false }) }
  },

  async onToggleNeedsWash() {
    const { item, saving } = this.data
    if (!item || saving) return
    this.setData({ saving: true })
    try {
      const updated = await api.patch('/items/' + item.id, { needs_wash: !item.needs_wash })
      this._applyItem(updated)
      wx.showToast({ title: updated.needs_wash ? '已标记待清洗' : '已标记为干净', icon: 'success' })
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
    finally { this.setData({ saving: false }) }
  },

  onDelete() {
    const { item } = this.data
    if (!item) return
    wx.showModal({
      title: '删除衣物',
      content: '删除后无法恢复（含图片），确定吗？',
      confirmText: '删除', confirmColor: '#c0392b',
      success: async (res) => {
        if (!res.confirm) return
        this.setData({ deleting: true })
        try {
          await api.delete('/items/' + item.id)
          wx.navigateBack()
        } catch (e) {
          this.setData({ deleting: false })
          wx.showToast({ title: e.message, icon: 'none' })
        }
      },
    })
  },

  _startPoll(id) {
    if (this._pollTimer) return
    this._pollTimer = setInterval(async () => {
      try { const item = await api.get('/items/' + id); this._applyItem(item) } catch {}
    }, 4000)
  },

  _stopPoll() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null }
  },
})
