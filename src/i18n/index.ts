import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import vi from './locales/vi-VN.json';

i18n
  .use(initReactI18next)
  .init({
    lng: 'vi', // Force Vietnamese
    fallbackLng: 'vi',
    debug: false,
    interpolation: {
      escapeValue: false,
    },
    resources: {
      vi: { translation: vi } 
    },
  });

export default i18n;
