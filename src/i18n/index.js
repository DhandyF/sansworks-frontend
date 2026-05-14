import { createI18n } from 'vue-i18n'
import en from './en.json'
import id from './id.json'

const savedLocale = localStorage.getItem('locale') || 'id'

const i18n = createI18n({
  legacy: false,
  locale: savedLocale,
  fallbackLocale: 'en',
  messages: { en, id },
})

export default i18n