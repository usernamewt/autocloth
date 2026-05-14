import { defineStore } from 'pinia'

export const useAgentStore = defineStore('agent', {
  state: () => ({
    template: '',
    pageTitle: '',
    message: '',
  }),
  actions: {
    setPage(template: string, title?: string, message?: string) {
      this.template = template
      this.pageTitle = title || '智能助手'
      this.message = message || ''
    },
    clear() {
      this.template = ''
      this.pageTitle = ''
      this.message = ''
    },
  },
})
