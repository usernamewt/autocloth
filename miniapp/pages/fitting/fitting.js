const auth = require('../../utils/auth')
const { api } = require('../../utils/api')
const { applyPageTheme } = require('../../utils/themeApply')

const OCCASIONS = ['日常', '通勤', '约会', '运动', '商务', '聚会']

function todayStr() {
  const d = new Date()
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0')
}

Page({
  data: {
    pageStyle: '',
    photos: [],
    selectedPhotoId: '',
    uploading: false,
    uploadType: 'full_body',
    mode: 'recommend',
    allItems: [],
    selectedItemIds: [],
    loadingItems: false,
    occasions: OCCASIONS,
    occasion: '日常',
    weatherDesc: '',
    date: todayStr(),
    recommending: false,
    recommendation: null,
    recommendedItems: [],
    recError: '',
    generating: false,
    generatingResultId: '',
    generateStatus: '',
    preprocessedImageUrl: '',
    resultImageUrl: '',
    generateError: '',
    history: [],
  },

  _pollTimer: null,

  onLoad() {
    if (!auth.isAuthenticated()) { wx.reLaunch({ url: '/pages/login/login' }); return }
    applyPageTheme(this)
    this._loadAll()
  },

  onShow() { applyPageTheme(this) },
  onUnload() { this._stopPoll() },

  async _loadAll() {
    await Promise.all([this.loadPhotos(), this.loadItems(), this.loadHistory()])
  },

  // ── 形象照 ──
  async loadPhotos() {
    try {
      const photos = await api.get('/fitting/photos')
      const list = photos || []
      this.setData({ photos: list, selectedPhotoId: list.length ? list[0].id : '' })
    } catch (e) { console.warn('loadPhotos', e.message) }
  },

  onSelectPhoto(e) { this.setData({ selectedPhotoId: e.currentTarget.dataset.id }) },

  onToggleType() {
    this.setData({ uploadType: this.data.uploadType === 'full_body' ? 'half_body' : 'full_body' })
  },

  onChoosePhoto() {
    const self = this
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['album', 'camera'],
      success(res) { self._uploadPhoto(res.tempFiles[0].tempFilePath) },
      fail() {
        wx.chooseImage({
          count: 1, sourceType: ['album', 'camera'],
          success(res2) { self._uploadPhoto(res2.tempFilePaths[0]) },
        })
      },
    })
  },

  async _uploadPhoto(filePath) {
    this.setData({ uploading: true })
    try {
      const photo = await api.upload('/fitting/photos', filePath, 'image', { photo_type: this.data.uploadType })
      const photos = [photo, ...this.data.photos]
      this.setData({ photos, selectedPhotoId: photo.id })
      wx.showToast({ title: '上传成功', icon: 'success' })
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
    finally { this.setData({ uploading: false }) }
  },

  onDeletePhoto(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除形象照', content: '删除后无法恢复', confirmColor: '#c0392b',
      success: async (res) => {
        if (!res.confirm) return
        try {
          await api.delete('/fitting/photos/' + id)
          const photos = this.data.photos.filter(p => p.id !== id)
          const sel = this.data.selectedPhotoId === id ? (photos[0] ? photos[0].id : '') : this.data.selectedPhotoId
          this.setData({ photos, selectedPhotoId: sel })
        } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
      },
    })
  },

  // ── 衣物 ──
  async loadItems() {
    this.setData({ loadingItems: true })
    try {
      const res = await api.get('/items?page_size=200')
      const allItems = (res.items || [])
        .filter(it => it.status === 'ready')
        .map(it => ({
          id: it.id, name: it.name || it.taxonomy_type_label || it.type || '未命名',
          imgUrl: it.thumbnail_url || it.image_url || '',
          primary_color: it.primary_color || '', selected: false,
        }))
      this.setData({ allItems })
    } catch (e) { console.warn('loadItems', e.message) }
    finally { this.setData({ loadingItems: false }) }
  },

  onToggleItem(e) {
    const id = e.currentTarget.dataset.id
    const allItems = this.data.allItems.map(it => it.id === id ? Object.assign({}, it, { selected: !it.selected }) : it)
    const selectedItemIds = allItems.filter(it => it.selected).map(it => it.id)
    this.setData({ allItems, selectedItemIds })
  },

  // ── 模式 ──
  setMode(e) { this.setData({ mode: e.currentTarget.dataset.mode, recError: '' }) },

  // ── 推荐 ──
  onOccasionTap(e) { this.setData({ occasion: e.currentTarget.dataset.val }) },
  onDateChange(e) { this.setData({ date: e.detail.value }) },
  onWeatherInput(e) { this.setData({ weatherDesc: e.detail.value }) },

  async doRecommend() {
    if (this.data.recommending) return
    this.setData({ recommending: true, recError: '', recommendation: null, recommendedItems: [] })
    try {
      const body = { date: this.data.date, occasion: this.data.occasion }
      if (this.data.weatherDesc.trim()) body.weather = { description: this.data.weatherDesc.trim() }
      const res = await api.post('/fitting/recommend', body)
      this.setData({ recommendation: res.recommendation || null, recommendedItems: res.items || [] })
    } catch (e) { this.setData({ recError: e.message || '推荐失败，请确保衣橱中有衣物' }) }
    finally { this.setData({ recommending: false }) }
  },

  // ── 生成 ──
  async doGenerate() {
    const { selectedPhotoId, recommendation, recommendedItems, mode, selectedItemIds, generating } = this.data
    if (!selectedPhotoId || generating) return
    const itemIds = mode === 'recommend'
      ? (recommendation ? (recommendation.item_ids || recommendedItems.map(it => it.id)) : [])
      : selectedItemIds
    if (!itemIds.length) {
      wx.showToast({ title: mode === 'recommend' ? '请先获取推荐' : '请选择衣物', icon: 'none' }); return
    }
    this.setData({ generating: true, generateStatus: 'generating', preprocessedImageUrl: '', resultImageUrl: '', generateError: '', generatingResultId: '' })
    try {
      const body = { photo_id: selectedPhotoId, item_ids: itemIds, occasion: this.data.occasion, outfit_date: this.data.date }
      if (this.data.weatherDesc.trim()) body.weather = { description: this.data.weatherDesc.trim() }
      if (mode === 'recommend' && recommendation) {
        body.prompt = recommendation.prompt
        body.outfit_name = recommendation.outfit_name
        body.reasoning = recommendation.reasoning
        body.style_tips = recommendation.style_tips
      }
      const result = await api.post('/fitting/generate', body)
      this.setData({ generatingResultId: result.id, generating: false })
      this._startPoll(result.id)
      this.loadHistory()
    } catch (e) {
      this.setData({ generating: false, generateStatus: 'error', generateError: e.message })
    }
  },

  _startPoll(resultId) {
    this._stopPoll()
    this._pollTimer = setInterval(async () => {
      try {
        const r = await api.get('/fitting/results/' + resultId)
        if (r.preprocessed_image_url && !this.data.preprocessedImageUrl) {
          this.setData({ preprocessedImageUrl: r.preprocessed_image_url })
        }
        if (r.status === 'ready') {
          this.setData({ generateStatus: 'ready', resultImageUrl: r.result_image_url || '', preprocessedImageUrl: r.preprocessed_image_url || this.data.preprocessedImageUrl })
          this._stopPoll(); this.loadHistory()
        } else if (r.status === 'error') {
          this.setData({ generateStatus: 'error', generateError: r.error_message || '生成失败' })
          this._stopPoll(); this.loadHistory()
        }
      } catch (e) { console.warn('poll', e.message) }
    }, 5000)
  },

  _stopPoll() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null }
  },

  onViewImage(e) {
    const url = e.currentTarget.dataset.url
    if (url) wx.previewImage({ urls: [url], current: url })
  },

  // ── 历史 ──
  async loadHistory() {
    try {
      const results = (await api.get('/fitting/results')) || []
      this.setData({ history: results.slice(0, 4) })
    } catch (e) { console.warn('loadHistory', e.message) }
  },

  goHistory() { wx.switchTab({ url: '/pages/history/history' }) },
})
