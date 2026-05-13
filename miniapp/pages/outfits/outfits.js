const auth = require('../../utils/auth')
const { api } = require('../../utils/api')
const { applyPageTheme } = require('../../utils/themeApply')

const OCCASIONS = ['日常', '通勤', '约会', '运动', '商务', '聚会']

function todayStr() {
  const d = new Date()
  return d.getFullYear() + '-' +
    String(d.getMonth() + 1).padStart(2, '0') + '-' +
    String(d.getDate()).padStart(2, '0')
}

function fmtDate(str) {
  if (!str) return ''
  try { return new Date(str).toLocaleDateString('zh-CN') } catch (e) { return str }
}

Page({
  data: {
    pageStyle: '',
    date: todayStr(),
    occasion: '日常',
    occasions: OCCASIONS,
    weatherDesc: '',
    recommending: false,
    recError: '',
    recSaved: false,
    recommendation: null,
    recommendedItems: [],
    history: [],
    itemMap: {},
    loadingHistory: false,
  },

  onLoad() {
    if (!auth.isAuthenticated()) { wx.reLaunch({ url: '/pages/login/login' }); return }
    applyPageTheme(this)
    wx.setNavigationBarTitle({ title: '穿搭推荐' })
    this.loadHistory()
  },

  onShow() { applyPageTheme(this) },

  onDateChange(e) { this.setData({ date: e.detail.value }) },
  onWeatherInput(e) { this.setData({ weatherDesc: e.detail.value }) },
  onOccasionTap(e) { this.setData({ occasion: e.currentTarget.dataset.val }) },

  async doRecommend() {
    if (this.data.recommending) return
    this.setData({ recommending: true, recError: '', recSaved: false, recommendation: null, recommendedItems: [] })
    try {
      const body = { date: this.data.date, occasion: this.data.occasion }
      if (this.data.weatherDesc.trim()) body.weather = { description: this.data.weatherDesc.trim() }
      const res = await api.post('/fitting/recommend', body)
      this.setData({
        recommendation: res.recommendation || null,
        recommendedItems: res.items || [],
        recSaved: !!res.recommendation_id,
      })
      this.loadHistory()
    } catch (e) {
      this.setData({ recError: e.message || '推荐失败，请确保衣橱中有衣物' })
    } finally {
      this.setData({ recommending: false })
    }
  },

  async loadHistory() {
    this.setData({ loadingHistory: true })
    try {
      const [results, itemsRes] = await Promise.all([
        api.get('/fitting/results'),
        api.get('/items?page=1&page_size=200'),
      ])
      const map = {}
      const items = (itemsRes && itemsRes.items) || []
      for (let i = 0; i < items.length; i++) map[items[i].id] = items[i]
      const history = (results || []).map(function(r) {
        const thumbs = (r.item_ids || []).slice(0, 5).map(function(id) {
          const it = map[id]
          return { id: id, imgUrl: it ? (it.thumbnail_url || it.image_url || '') : '' }
        })
        const extra = r.item_ids && r.item_ids.length > 5 ? r.item_ids.length - 5 : 0
        return Object.assign({}, r, {
          thumbs: thumbs,
          extraCount: extra,
          fmtDate: fmtDate(r.outfit_date || r.created_at),
          statusIcon: r.status === 'generating' ? '⏳' : r.status === 'error' ? '⚠️' : '👗',
          statusText: r.status === 'generating' ? '合成中…' : r.status === 'error' ? '合成失败' : '穿搭推荐',
        })
      })
      this.setData({ history: history, itemMap: map })
    } catch (e) { console.warn('loadHistory', e.message) }
    finally { this.setData({ loadingHistory: false }) }
  },

  onItemTap(e) {
    wx.navigateTo({ url: '/pages/item-detail/item-detail?id=' + e.currentTarget.dataset.id })
  },

  goFitting() {
    wx.switchTab({ url: '/pages/fitting/fitting' })
  },
})
