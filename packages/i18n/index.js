import en from './en.json';
import ko from './ko.json';
import zh from './zh.json';
import ja from './ja.json';

export const translations = { en, ko, zh, ja };

export const getTranslation = (lang, key) => {
  const keys = key.split('.');
  let result = translations[lang] || translations['en'];
  
  for (const k of keys) {
    result = result[k];
    if (!result) return key; // 키가 없을 경우 키 이름 그대로 반환
  }
  
  return result;
};