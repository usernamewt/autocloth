const auth = require('../../utils/auth')
const { api } = require('../../utils/api')
const { applyPageTheme } = require('../../utils/themeApply')

function fmtTime(s) {
  if (!s) return ''
  const d = new Date(s)
  const pad = n => String(n).padStart(2, '0')
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

Page({
  data: {
    pageStyle: '',
    history: [],
    itemMap: {},
    loading: true,
    todayBanner: null,  // { outfit_name, result_id, status }
  },

  onLoad() {
    if (!auth.isAuthenticated()) { wx.reLaunch({ url: '/pages/login/login' }); return }
    applyPageTheme(this)
    this.loadAll()
  },

  onShow() {
    applyPageTheme(this)
    this.loadAll()
    this._checkTodayBadge()
  },

  async _checkTodayBadge() {
    try {
      const res = await api.get('/daily-outfit/today-status')
      if (res && res.has_today_result) {
        this.setData({
          todayBanner: {
            outfit_name: res.today_outfit_name || '今日穿搭已备好',
            result_id: res.today_result_id,
            status: res.today_result_status,
          },
        })
      }
      if (res && res.notification_pending) {
        await api.post('/daily-outfit/mark-seen', {})
        wx.removeTabBarBadge({ index: 3 })
      }
    } catch (e) { console.warn('checkTodayBadge', e.message) }
  },

  async loadAll() {
    this.setData({ loading: true })
    try {
      const [results, itemsRes] = await Promise.all([
        api.get('/fitting/results'),
        api.get('/items?page=1&page_size=200'),
      ])
      const map = {}
      const items = (itemsRes && itemsRes.items) || []
      for (let i = 0; i < items.length; i++) map[items[i].id] = items[i]

      const history = (results || []).map(r => {
        const thumbs = (r.item_ids || []).slice(0, 6).map(id => {
          const it = map[id]
          return { id, imgUrl: it ? (it.thumbnail_url || it.image_url || '') : '' }
        })
        const extra = (r.item_ids || []).length > 6 ? (r.item_ids.length - 6) : 0
        return Object.assign({}, r, {
          thumbs,
          extraCount: extra,
          fmtTime: fmtTime(r.created_at),
          statusIcon: r.status === 'generating' ? '⏳' : r.status === 'error' ? '⚠️' : '👗',
          statusLabel: r.status === 'generating' ? '合成中…' : r.status === 'error' ? '合成失败' : '穿搭推荐',
          hasImage: !!r.result_image_url,
          isPureRec: r.status === 'pending' && !r.photo_id,
        })
      })
      this.setData({ history, itemMap: map })
    } catch (e) { console.warn('loadAll', e.message) }
    finally { this.setData({ loading: false }) }
  },

  onViewImage(e) {
    const url = e.currentTarget.dataset.url
    if (url) wx.previewImage({ urls: [url], current: url })
  },

  onDeleteResult(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '删除试衣记录', content: '删除后无法恢复', confirmColor: '#c0392b',
      success: async res => {
        if (!res.confirm) return
        try {
          await api.delete('/fitting/results/' + id)
          this.setData({ history: this.data.history.filter(r => r.id !== id) })
          wx.showToast({ title: '已删除', icon: 'success' })
        } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
      },
    })
  },

  goFitting() { wx.switchTab({ url: '/pages/fitting/fitting' }) },
})
