const auth = require('../../utils/auth')
const { api } = require('../../utils/api')
const { applyPageTheme } = require('../../utils/themeApply')
const { getThemeList } = require('../../utils/themes')

Page({
  data: {
    user: {},
    avatarLetter: '?',
    userIdShort: '',
    registeredAt: '',
    statsLoading: true,
    stats: { total: 0, favorites: 0, needsWash: 0, wardrobes: 0 },
    pageStyle: '',
    currentTheme: 'warm',
    themeList: [],
    // AI 穿搭闹钟
    alarmExists: false,
    alarmEnabled: false,
    alarmTime: '08:00',
    alarmOccasion: '日常',
    alarmSaving: false,
    occasionList: ['日常', '通勤', '约会', '运动', '商务', '聚会'],
  },

  onLoad() {
    if (!auth.isAuthenticated()) {
      wx.reLaunch({ url: '/pages/login/login' })
      return
    }
    const themeList = getThemeList()
    this.setData({ themeList })
    const cached = auth.getUser() || {}
    this._applyUser(cached)
    this.loadUser()
    this.loadStats()
    this.loadAlarm()
  },

  onShow() {
    applyPageTheme(this)
    if (auth.isAuthenticated()) this.loadStats()
  },

  async loadAlarm() {
    try {
      const res = await api.get('/daily-outfit/schedule')
      if (res && res.exists) {
        this.setData({
          alarmExists: true,
          alarmEnabled: !!res.enabled,
          alarmTime: res.alarm_time || '08:00',
          alarmOccasion: res.occasion || '日常',
        })
      }
    } catch (e) { console.warn('loadAlarm', e.message) }
  },

  onAlarmTimeChange(e) {
    this.setData({ alarmTime: e.detail.value })
  },

  onAlarmOccasionTap(e) {
    this.setData({ alarmOccasion: e.currentTarget.dataset.val })
  },

  async onAlarmToggle() {
    const { alarmEnabled, alarmExists, alarmTime, alarmOccasion } = this.data
    if (!alarmExists && !alarmEnabled) {
      await this.saveAlarm()
      return
    }
    const newEnabled = !alarmEnabled
    this.setData({ alarmEnabled: newEnabled })
    try {
      await api.post('/daily-outfit/schedule', { alarm_time: alarmTime, occasion: alarmOccasion, enabled: newEnabled })
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
  },

  async saveAlarm() {
    const { alarmTime, alarmOccasion } = this.data
    if (!alarmTime) { wx.showToast({ title: '请设置出门时间', icon: 'none' }); return }
    this.setData({ alarmSaving: true })
    try {
      await api.post('/daily-outfit/schedule', { alarm_time: alarmTime, occasion: alarmOccasion, enabled: true })
      this.setData({ alarmExists: true, alarmEnabled: true })
      wx.showToast({ title: '闹钟已设置 ⏰', icon: 'none' })
      getApp().checkDailyOutfitBadge()
    } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
    finally { this.setData({ alarmSaving: false }) }
  },

  async deleteAlarm() {
    wx.showModal({
      title: '关闭 AI 穿搭闹钟', content: '将停止每日自动生成穿搭', confirmColor: '#c0392b',
      success: async r => {
        if (!r.confirm) return
        try {
          await api.delete('/daily-outfit/schedule')
          this.setData({ alarmExists: false, alarmEnabled: false })
          wx.removeTabBarBadge({ index: 3 })
        } catch (e) { wx.showToast({ title: e.message, icon: 'none' }) }
      }
    })
  },

  async loadUser() {
    try {
      const user = await api.get('/users/me')
      auth.setSession(auth.getToken(), user)
      getApp().globalData.user = user
      this._applyUser(user)
    } catch (e) {
      console.warn('loadUser error', e.message)
    }
  },

  _applyUser(user) {
    const letter = ((user.display_name || user.email || '?').charAt(0)).toUpperCase()
    const idShort = user.id ? user.id.slice(0, 8) + '…' : ''
    const registeredAt = user.created_at
      ? new Date(user.created_at).toLocaleDateString('zh-CN', {
          year: 'numeric', month: 'long', day: 'numeric',
        })
      : ''
    this.setData({ user, avatarLetter: letter, userIdShort: idShort, registeredAt })
  },

  async loadStats() {
    this.setData({ statsLoading: true })
    try {
      const [all, fav, wash, wards] = await Promise.all([
        api.get('/items?page_size=1'),
        api.get('/items?favorite=true&page_size=1'),
        api.get('/items?needs_wash=true&page_size=1'),
        api.get('/wardrobes'),
      ])
      this.setData({
        stats: {
          total: all.total || 0,
          favorites: fav.total || 0,
          needsWash: wash.total || 0,
          wardrobes: Array.isArray(wards) ? wards.length : 0,
        },
      })
    } catch (e) {
      console.warn('loadStats error', e.message)
    } finally {
      this.setData({ statsLoading: false })
    }
  },

  goAddItem() {
    wx.navigateTo({ url: '/pages/item-create/item-create' })
  },

  goFitting() {
    wx.switchTab({ url: '/pages/fitting/fitting' })
  },

  goOutfits() {
    wx.switchTab({ url: '/pages/outfits/outfits' })
  },

  onSelectTheme(e) {
    const key = e.currentTarget.dataset.key
    if (!key) return
    getApp().setTheme(key)
    applyPageTheme(this)
  },

  onLogout() {
    wx.showModal({
      title: '退出登录',
      content: '确定要退出当前账号吗？',
      confirmText: '退出',
      confirmColor: '#c0392b',
      success: (res) => {
        if (res.confirm) {
          auth.logout()
          getApp().globalData.user = null
          wx.reLaunch({ url: '/pages/login/login' })
        }
      },
    })
  },
})
