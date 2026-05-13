const auth = require('../../utils/auth')

Page({
  onLoad() {
    if (auth.isAuthenticated()) {
      wx.switchTab({ url: '/pages/items/items' })
    } else {
      wx.reLaunch({ url: '/pages/login/login' })
    }
  },
})
