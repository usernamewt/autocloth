const { BASE_URL } = require('./config')
const auth = require('./auth')

function request(method, path, data, options = {}) {
  return new Promise((resolve, reject) => {
    const token = auth.getToken()
    const header = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.header || {}),
    }

    wx.request({
      url: `${BASE_URL}/api/v1${path}`,
      method,
      data: data !== undefined ? data : undefined,
      header,
      timeout: 30000,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else if (res.statusCode === 401) {
          auth.logout()
          wx.reLaunch({ url: '/pages/login/login' })
          reject(new Error('未授权，请重新登录'))
        } else {
          const d = res.data || {}
          const msg =
            (typeof d.detail === 'string' ? d.detail : d.detail?.message) ||
            d.message ||
            d.error ||
            `请求失败 (${res.statusCode})`
          reject(new Error(msg))
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '网络连接失败'))
      },
    })
  })
}

function uploadFile(path, filePath, name, formData, options = {}) {
  return new Promise((resolve, reject) => {
    const token = auth.getToken()
    wx.uploadFile({
      url: `${BASE_URL}/api/v1${path}`,
      filePath,
      name,
      formData: formData || {},
      header: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.header || {}),
      },
      timeout: 60000,
      success(res) {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(res.data))
          } catch {
            resolve(res.data)
          }
        } else if (res.statusCode === 401) {
          auth.logout()
          wx.reLaunch({ url: '/pages/login/login' })
          reject(new Error('未授权，请重新登录'))
        } else {
          try {
            const d = JSON.parse(res.data) || {}
            const msg =
              (typeof d.detail === 'string' ? d.detail : d.detail?.message) ||
              d.message || d.error || `上传失败 (${res.statusCode})`
            reject(new Error(msg))
          } catch {
            reject(new Error(`上传失败 (${res.statusCode})`))
          }
        }
      },
      fail(err) {
        reject(new Error(err.errMsg || '上传失败'))
      },
    })
  })
}

const api = {
  get: (path, options) => request('GET', path, undefined, options),
  post: (path, data, options) => request('POST', path, data, options),
  put: (path, data, options) => request('PUT', path, data, options),
  patch: (path, data, options) => request('PATCH', path, data, options),
  delete: (path, options) => request('DELETE', path, undefined, options),
  upload: (path, filePath, name, formData, options) =>
    uploadFile(path, filePath, name, formData, options),
}

module.exports = { api }
