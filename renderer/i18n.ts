export type Lang = 'tr' | 'en';

const translations = {
  // Titlebar
  'app.title': { tr: 'Ekran OCR', en: 'Screen OCR' },
  'app.hotkey': { tr: 'Ctrl+Shift+X', en: 'Ctrl+Shift+X' },

  // Main view
  'main.selectArea': { tr: 'Alan Sec', en: 'Select Area' },
  'main.snipEdit': { tr: 'Kes & Duzenle', en: 'Snip & Edit' },
  'main.scanClipboard': { tr: 'Panodan Tara', en: 'Scan Clipboard' },
  'main.lastResult': { tr: 'Son Sonuc', en: 'Last Result' },
  'main.settings': { tr: 'Ayarlar', en: 'Settings' },
  'main.ocrModel': { tr: 'OCR Modeli', en: 'OCR Model' },
  'main.correctionModel': { tr: 'Duzeltme Modeli', en: 'Correction Model' },
  'main.noApiKey': { tr: 'API anahtari ayarlanmadi', en: 'API key not set' },
  'main.noModel': { tr: 'Model secilmedi', en: 'No model selected' },
  'main.free': { tr: 'Ucretsiz', en: 'Free' },
  'main.paid': { tr: 'Ucretli', en: 'Paid' },

  // Result view
  'result.title': { tr: 'Sonuc', en: 'Result' },
  'result.copy': { tr: 'Kopyala', en: 'Copy' },
  'result.copied': { tr: 'Kopyalandi!', en: 'Copied!' },
  'result.rescan': { tr: 'Tekrar Tara', en: 'Rescan' },
  'result.confidence': { tr: 'Guven', en: 'Confidence' },
  'result.language': { tr: 'Dil', en: 'Language' },
  'result.handwriting': { tr: 'El Yazisi', en: 'Handwriting' },
  'result.correcting': { tr: 'Duzeltiliyor...', en: 'Correcting...' },
  'result.corrected': { tr: 'Duzeltildi', en: 'Corrected' },
  'result.extracting': { tr: 'Metin cikartiliyor...', en: 'Extracting text...' },

  // Settings
  'settings.title': { tr: 'Ayarlar', en: 'Settings' },
  'settings.apiKey': { tr: 'API Anahtari', en: 'API Key' },
  'settings.apiKeyPlaceholder': { tr: 'OpenRouter API anahtarinizi girin', en: 'Enter your OpenRouter API key' },
  'settings.ocrTab': { tr: 'OCR Modeli', en: 'OCR Model' },
  'settings.correctionTab': { tr: 'AI Duzeltme', en: 'AI Correction' },
  'settings.fetchModels': { tr: 'Modelleri Getir', en: 'Fetch Models' },
  'settings.refresh': { tr: 'Yenile', en: 'Refresh' },
  'settings.all': { tr: 'Tumu', en: 'All' },
  'settings.search': { tr: 'Model ara...', en: 'Search models...' },
  'settings.enableCorrection': { tr: 'AI metin duzeltmeyi etkinlestir', en: 'Enable AI text correction' },
  'settings.correctionHelp': { tr: 'OCR sonrasi karakter hatalarini duzeltir', en: 'Fixes OCR character errors after extraction' },
  'settings.autoLaunch': { tr: 'Bilgisayar acildiginda baslat', en: 'Start on system boot' },
  'settings.autoCopy': { tr: 'Sonucu otomatik kopyala', en: 'Auto-copy result' },
  'settings.globalHotkey': { tr: 'Genel Kisayol', en: 'Global Hotkey' },
  'settings.save': { tr: 'Kaydet', en: 'Save' },

  // Editor
  'editor.title': { tr: 'Goruntu Duzenleyici', en: 'Snip Editor' },
  'editor.copy': { tr: 'Kopyala', en: 'Copy' },
  'editor.copied': { tr: 'Kopyalandi!', en: 'Copied!' },
  'editor.save': { tr: 'PNG Kaydet', en: 'Save PNG' },
  'editor.close': { tr: 'Kapat', en: 'Close' },
  'editor.textPlaceholder': { tr: 'Yazin... (Ctrl+Enter uygula)', en: 'Type... (Ctrl+Enter to apply)' },

  // Theme
  'theme.light': { tr: 'Acik', en: 'Light' },
  'theme.dark': { tr: 'Koyu', en: 'Dark' },
} as const;

export type TranslationKey = keyof typeof translations;

export function t(key: TranslationKey, lang: Lang): string {
  return translations[key]?.[lang] ?? key;
}

export function getStoredLang(): Lang {
  return (localStorage.getItem('app-lang') as Lang) || 'tr';
}

export function setStoredLang(lang: Lang) {
  localStorage.setItem('app-lang', lang);
}
