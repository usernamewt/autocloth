const auth = require('./utils/auth')
const { api } = require('./utils/api')

App({
  globalData: {
    user: null,
    systemInfo: null,
    safeAreaBottom: 0,
    theme: 'warm',
  },

  onLaunch() {
    // 恢复主题
    try {
      const saved = wx.getStorageSync('theme')
      if (saved) this.globalData.theme = saved
    } catch (e) {}

    // 获取系统信息，计算 iOS 安全区
    try {
      const sysInfo = wx.getSystemInfoSync()
      this.globalData.systemInfo = sysInfo
      const safeArea = sysInfo.safeArea
      const screenHeight = sysInfo.screenHeight
      this.globalData.safeAreaBottom = safeArea ? screenHeight - safeArea.bottom : 0
    } catch (e) {
      console.warn('getSystemInfo failed', e)
    }

    // 恢复登录状态
    if (auth.isAuthenticated()) {
      this.globalData.user = auth.getUser()
      this.checkDailyOutfitBadge()
    }
  },

  // 检查 AI 穿搭闹钟通知，设置/清除历史 tab badge（index 3）
  checkDailyOutfitBadge() {
    if (!auth.isAuthenticated()) return
    api.get('/daily-outfit/today-status').then(res => {
      if (res && res.notification_pending) {
        wx.setTabBarBadge({ index: 3, text: '新' })
      } else {
        wx.removeTabBarBadge({ index: 3 })
      }
    }).catch(() => {})
  },

  setTheme(themeKey) {
    this.globalData.theme = themeKey
    try { wx.setStorageSync('theme', themeKey) } catch (e) {}
  },

  // 全局跳转登录（供各页面调用）
  requireAuth(redirectUrl) {
    if (!auth.isAuthenticated()) {
      wx.reLaunch({
        url: `/pages/login/login${redirectUrl ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''}`,
      })
      return false
    }
    return true
  },
})
