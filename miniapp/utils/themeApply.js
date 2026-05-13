/**
 * utils/themeApply.js
 * 每个页面在 onLoad / onShow 中调用 applyPageTheme(this)
 */
const { getTheme, getPageStyle } = require('./themes')

function applyPageTheme(page) {
  const app = getApp()
  const themeKey = (app && app.globalData && app.globalData.theme) || 'warm'
  const theme = getTheme(themeKey)
  const pageStyle = getPageStyle(themeKey)

  page.setData({ pageStyle: pageStyle, currentTheme: themeKey })

  try {
    wx.setNavigationBarColor({
      frontColor: theme.navFront,
      backgroundColor: theme.navBg,
      animation: { duration: 200, timingFunc: 'easeIn' },
    })
  } catch (e) {}

  try {
    wx.setTabBarStyle({
      color: theme.tabColor,
      selectedColor: theme.tabSelected,
      backgroundColor: theme.tabBg,
      borderStyle: theme.navFront === '#ffffff' ? 'black' : 'white',
    })
  } catch (e) {}
}

module.exports = { applyPageTheme }
