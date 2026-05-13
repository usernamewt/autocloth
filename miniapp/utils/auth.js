const TOKEN_KEY = 'wa_access_token'
const USER_KEY = 'wa_user'

function getToken() {
  return wx.getStorageSync(TOKEN_KEY) || ''
}

function setToken(token) {
  wx.setStorageSync(TOKEN_KEY, token)
}

function getUser() {
  try {
    return wx.getStorageSync(USER_KEY) || null
  } catch {
    return null
  }
}

function setUser(user) {
  wx.setStorageSync(USER_KEY, user)
}

function isAuthenticated() {
  return !!getToken()
}

function setSession(token, user) {
  setToken(token)
  if (user) setUser(user)
}

function logout() {
  wx.removeStorageSync(TOKEN_KEY)
  wx.removeStorageSync(USER_KEY)
}

module.exports = { getToken, getUser, setSession, isAuthenticated, logout }
