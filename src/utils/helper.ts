export const convertI18nKeyToText = (key: string, t: (key: string) => string): string => {
  // If the key looks like an i18n key, translate it; otherwise return as-is
  return key.includes('.') ? t(key) : key;
};
