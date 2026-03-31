export type Lang = 'tr' | 'en';

const translations = {
  // Titlebar
  'app.title': { tr: 'Ekran OCR', en: 'Screen OCR' },
  'app.hotkey': { tr: 'Ctrl+Shift+X', en: 'Ctrl+Shift+X' },

  // Main view
  'main.selectArea': { tr: 'Metin Sec', en: 'Select Text' },
  'main.snipEdit': { tr: 'Kes & Duzenle', en: 'Snip & Edit' },
  'main.scanClipboard': { tr: 'Panodan Tara', en: 'Scan Clipboard' },
  'main.blurCapture': { tr: 'Odak Yakala', en: 'Focus Capture' },
  'main.openFile': { tr: 'Dosya Ac', en: 'Open File' },
  'main.blurFromFile': { tr: 'Resimden Blur', en: 'Blur from File' },
  'blur.title': { tr: 'Odak Onizleme', en: 'Focus Preview' },
  'blur.save': { tr: 'PNG Kaydet', en: 'Save PNG' },
  'blur.saved': { tr: 'Kaydedildi!', en: 'Saved!' },
  'blur.retake': { tr: 'Tekrar Cek', en: 'Retake' },
  'blur.cancel': { tr: 'Iptal', en: 'Cancel' },
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
  'result.cached': { tr: 'Onbellekten', en: 'Cached' },

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
  'editor.pen': { tr: 'Kalem', en: 'Pen' },
  'editor.highlighter': { tr: 'Isaretleyici', en: 'Highlighter' },
  'editor.fade': { tr: 'Solma Kalem', en: 'Fade Pen' },
  'editor.laser': { tr: 'Lazer', en: 'Laser' },
  'editor.select': { tr: 'Sec', en: 'Select' },
  'editor.arrow': { tr: 'Ok', en: 'Arrow' },
  'editor.line': { tr: 'Cizgi', en: 'Line' },
  'editor.rect': { tr: 'Dikdortgen', en: 'Rectangle' },
  'editor.oval': { tr: 'Oval', en: 'Oval' },
  'editor.text': { tr: 'Metin', en: 'Text' },
  'editor.eraser': { tr: 'Silgi', en: 'Eraser' },
  'editor.rainbow': { tr: 'Gokkusagi', en: 'Rainbow' },
  'editor.undo': { tr: 'Geri Al', en: 'Undo' },
  'editor.redo': { tr: 'Ileri Al', en: 'Redo' },
  'editor.clear': { tr: 'Temizle', en: 'Clear' },
  'editor.collapse': { tr: 'Daralt', en: 'Collapse' },
  'editor.expand': { tr: 'Genislet', en: 'Expand' },

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
