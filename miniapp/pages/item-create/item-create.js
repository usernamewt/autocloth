const auth = require('../../utils/auth')
const { api } = require('../../utils/api')
const { applyPageTheme } = require('../../utils/themeApply')

const PARTS = [
  { value: 'top',   label: '上衣' },
  { value: 'dress', label: '连衣裙' },
  { value: 'skirt', label: '裙子' },
  { value: 'pants', label: '裤子' },
  { value: 'shoes', label: '鞋子' },
  { value: 'bag',   label: '包' },
  { value: 'hat',   label: '帽子' },
  { value: 'scarf', label: '围巾' },
]

const PART_PROMPTS = {
  top:   '请从图片中只保留单件上衣本体，完整呈现衣服轮廓（含袖子、领口、下摆），移除人物、皮肤、头发、背景、阴影与水印。将衣服居中摆放，保持真实颜色材质，背景替换为干净纯色（接近#F7F7F7）。输出电商商品图风格，清晰整洁。',
  dress: '请从图片中只保留连衣裙本体，完整呈现裙身轮廓（含领口、袖子、裙摆），移除人物、皮肤、背景、阴影与水印。将裙子居中摆放，保持真实颜色材质，背景替换为干净纯色（接近#F7F7F7）。输出电商商品图风格，清晰整洁。',
  skirt: '请从图片中只保留裙子本体，完整呈现裙摆轮廓，移除人物、皮肤、背景、阴影与水印。居中摆放，保持真实颜色材质，背景替换为干净纯色（接近#F7F7F7）。输出电商商品图风格，清晰整洁。',
  pants: '请从图片中只保留裤子本体，完整呈现裤子轮廓（含腰头、裤腿、口袋），移除人物、皮肤、鞋子、背景、阴影与水印。居中摆放，保持真实颜色材质，背景替换为干净纯色（接近#F7F7F7）。输出电商商品图风格，清晰整洁。',
  shoes: '请从图片中只保留鞋子本体，完整呈现鞋面轮廓，移除人物、地面、背景、阴影与水印。居中摆放，保持真实颜色材质，背景替换为干净纯色（接近#F7F7F7）。输出电商商品图风格，清晰整洁。',
  bag:   '请从图片中只保留包袋本体，完整呈现包袋轮廓（含提手、五金、缝线），移除人物、背景、阴影与水印。居中摆放，保持真实颜色材质，背景替换为干净纯色（接近#F7F7F7）。输出电商商品图风格，清晰整洁。',
  hat:   '请从图片中只保留帽子本体，完整呈现帽子轮廓，移除人物、头发、皮肤、背景、阴影与水印。居中摆放，保持真实颜色材质，背景替换为干净纯色（接近#F7F7F7）。输出电商商品图风格，清晰整洁。',
  scarf: '请从图片中只保留围巾/领巾本体，完整呈现形状与图案，移除人物、背景、阴影与水印。平铺或悬挂展示，保持真实颜色材质，背景替换为干净纯色（接近#F7F7F7）。输出电商商品图风格，清晰整洁。',
}

Page({
  data: {
    pageStyle: '',
    parts: PARTS,
    part: 'top',
    filePath: '',
    previewUrl: '',
    name: '',
    brand: '',
    // idle | uploading | processing | classifying | done | error
    status: 'idle',
    statusText: '',
    errorText: '',
    createdId: '',
  },

  _pollTimer: null,

  onLoad() {
    if (!auth.isAuthenticated()) { wx.reLaunch({ url: '/pages/login/login' }); return }
    applyPageTheme(this)
  },

  onShow() { applyPageTheme(this) },
  onUnload() { this._stopPoll() },

  onPartTap(e) {
    this.setData({ part: e.currentTarget.dataset.val })
  },

  onNameInput(e) { this.setData({ name: e.detail.value }) },
  onBrandInput(e) { this.setData({ brand: e.detail.value }) },

  onChooseImage() {
    const self = this
    wx.chooseMedia({
      count: 1, mediaType: ['image'], sourceType: ['album', 'camera'],
      success(res) { self._setImage(res.tempFiles[0].tempFilePath) },
      fail() {
        wx.chooseImage({
          count: 1, sourceType: ['album', 'camera'],
          success(res2) { self._setImage(res2.tempFilePaths[0]) },
        })
      },
    })
  },

  _setImage(filePath) {
    this.setData({ filePath, previewUrl: filePath, status: 'idle', errorText: '' })
  },

  async submit() {
    const { filePath, part, name, brand, status } = this.data
    if (!filePath) { wx.showToast({ title: '请先选择图片', icon: 'none' }); return }
    if (status === 'uploading' || status === 'processing' || status === 'classifying') return

    this.setData({ status: 'uploading', statusText: '正在上传图片…', errorText: '' })
    try {
      const prompt = PART_PROMPTS[part] || PART_PROMPTS.top
      const formData = { type: 'unknown', part, prompt }
      if (name.trim()) formData.name = name.trim()
      if (brand.trim()) formData.brand = brand.trim()

      const created = await api.upload('/items', filePath, 'image', formData)

      this.setData({ createdId: created.id })

      if (created.status === 'processing') {
        this.setData({ status: 'processing', statusText: 'AI 正在抠图，通常需要 10~30 秒…' })
        this._startPoll(created.id)
      } else {
        this._afterProcessing(created.id)
      }
    } catch (e) {
      this.setData({ status: 'error', errorText: e.message || '上传失败，请重试' })
    }
  },

  _startPoll(id) {
    this._stopPoll()
    this._pollTimer = setInterval(async () => {
      try {
        const item = await api.get('/items/' + id)
        if (item.status === 'ready') {
          this._stopPoll()
          this._afterProcessing(id)
        } else if (item.status === 'error') {
          this._stopPoll()
          this.setData({ status: 'error', errorText: 'AI 处理失败，请重新录入' })
        }
      } catch (e) { console.warn('poll', e.message) }
    }, 4000)
  },

  _stopPoll() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null }
  },

  async _afterProcessing(id) {
    this.setData({ status: 'classifying', statusText: 'AI 正在识别分类，稍后自动跳转…' })
    try {
      await api.post('/items/' + id + '/ai-classify', {})
    } catch (e) { console.warn('classify warn', e.message) }
    this.setData({ status: 'done', statusText: '录入完成 ✓' })
    setTimeout(() => {
      wx.redirectTo({ url: '/pages/item-detail/item-detail?id=' + id })
    }, 600)
  },

  onRetry() {
    this.setData({ status: 'idle', errorText: '', statusText: '' })
  },
})
