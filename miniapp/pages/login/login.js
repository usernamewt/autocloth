const { api } = require('../../utils/api')
const auth = require('../../utils/auth')

Page({
  data: {
    email: '',
    nickname: '',
    loading: false,
    error: '',
    focusField: '',
  },

  onLoad(options) {
    this._redirect = options.redirect ? decodeURIComponent(options.redirect) : ''
    // 已登录则直接跳过
    if (auth.isAuthenticated()) {
      this._doRedirect()
    }
  },

  onEmailInput(e) {
    this.setData({ email: e.detail.value, error: '' })
  },

  onNicknameInput(e) {
    this.setData({ nickname: e.detail.value })
  },

  onFocus(e) {
    this.setData({ focusField: e.currentTarget.dataset.field })
  },

  onBlur() {
    this.setData({ focusField: '' })
  },

  async onLogin() {
    const { email, nickname, loading } = this.data
    if (loading || !email.trim()) return

    this.setData({ loading: true, error: '' })

    try {
      const trimmedEmail = email.trim().toLowerCase()
      const displayName = nickname.trim() || trimmedEmail.split('@')[0]

      const res = await api.post('/auth/sync', {
        external_id: trimmedEmail,
        email: trimmedEmail,
        display_name: displayName,
        avatar_url: null,
      })

      auth.setSession(res.access_token, res.user || { email: trimmedEmail, display_name: displayName })
      getApp().globalData.user = res.user || { email: trimmedEmail, display_name: displayName }

      this._doRedirect()
    } catch (err) {
      this.setData({ error: err.message || '登录失败，请重试' })
    } finally {
      this.setData({ loading: false })
    }
  },

  _doRedirect() {
    if (this._redirect) {
      wx.reLaunch({ url: this._redirect })
    } else {
      wx.switchTab({ url: '/pages/items/items' })
    }
  },
})
