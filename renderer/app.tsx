import React, { useState, useEffect, useRef, useCallback } from 'react';
import ResultPanel from './result-panel';
import Settings from './settings';
import Editor from './editor';
import { type Lang, type TranslationKey, t, getStoredLang, setStoredLang } from './i18n';
import { type Theme, getStoredTheme, setStoredTheme, applyTheme } from './theme';
import { performOCR, correctText, type OCRResult } from './ocr-engine';

type View = 'main' | 'result' | 'settings' | 'editor' | 'blur-preview';
const MAIN_WIDTH = 400;
const MAIN_HEIGHT = 390;
const DETAIL_HEIGHT = 500;

export interface OCRModel { id: string; name: string; free: boolean; }
export interface TextModel { id: string; name: string; free: boolean; }

export default function App() {
  const [lang, setLangState] = useState<Lang>(getStoredLang);
  const [theme, setThemeState] = useState<Theme>(getStoredTheme);
  const [view, setView] = useState<View>('main');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OCRResult | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [correctionModel, setCorrectionModel] = useState('');
  const [correctionEnabled, setCorrectionEnabled] = useState(true);
  const [models, setModels] = useState<OCRModel[]>([]);
  const [textModels, setTextModels] = useState<TextModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [snipImage, setSnipImage] = useState<string | null>(null);
  const [blurImage, setBlurImage] = useState<string | null>(null);
  const [blurSaved, setBlurSaved] = useState(false);

  const runOCRRef = useRef<(base64: string) => Promise<void>>();

  const T = useCallback((key: TranslationKey) => t(key, lang), [lang]);

  function changeLang(l: Lang) { setLangState(l); setStoredLang(l); }
  function changeTheme(th: Theme) { setThemeState(th); setStoredTheme(th); applyTheme(th); }

  useEffect(() => { applyTheme(theme); }, []);

  const runOCR = useCallback(async (imageBase64: string) => {
    const key = apiKey || localStorage.getItem('openrouter-api-key') || '';
    const model = selectedModel || localStorage.getItem('ocr-model') || '';
    const corrModel = correctionModel || localStorage.getItem('correction-model') || '';
    const corrEnabled = correctionEnabled ?? localStorage.getItem('correction-enabled') !== 'false';

    if (!key) { setView('settings'); return; }
    if (!model) { setView('settings'); return; }

    setLoading(true);
    setView('result');

    try {
      // Use the OCR engine with improved prompts, retry, and cache
      const ocrResult = await performOCR(key, model, imageBase64);
      ocrResult.correcting = corrEnabled && !!corrModel;

      if (ocrResult.fromCache) {
        console.log('[OCR] Result served from cache');
      }

      setResult(ocrResult);
      setLoading(false);

      const autoCopy = localStorage.getItem('auto-copy') !== 'false';
      if (autoCopy && ocrResult.fullText) window.electronAPI?.copyToClipboard(ocrResult.fullText);

      // Text correction pass
      if (corrEnabled && corrModel && ocrResult.fullText && ocrResult.fullText.length > 2) {
        const corrected = await correctText(key, corrModel, ocrResult.fullText);
        if (corrected && corrected !== ocrResult.fullText) {
          const correctedResult: OCRResult = { ...ocrResult, fullText: corrected, corrected: true, correcting: false };
          setResult(correctedResult);
          if (autoCopy) window.electronAPI?.copyToClipboard(corrected);
        } else {
          setResult(prev => prev ? { ...prev, correcting: false } : prev);
        }
      }
    } catch (err: any) {
      setResult({ fullText: `Error: ${err.message}`, language: 'unknown', confidence: 0, containsHandwriting: false, modelUsed: 'error' });
      setLoading(false);
    }
  }, [apiKey, selectedModel, correctionModel, correctionEnabled]);

  useEffect(() => { runOCRRef.current = runOCR; }, [runOCR]);

  useEffect(() => {
    window.electronAPI?.onCaptureComplete(async (base64: string) => {
      setCapturedImage(base64);
      runOCRRef.current?.(base64);
    });
    window.electronAPI?.onSnipComplete((base64: string) => {
      setSnipImage(base64);
      setView('editor');
    });
    window.electronAPI?.onBlurPreview(async (base64: string) => {
      setBlurImage(base64);
      setBlurSaved(false);
      const screen = await window.electronAPI?.getScreenSize();
      if (screen) {
        const w = Math.min(900, screen.width - 100);
        const h = Math.min(700, screen.height - 100);
        window.electronAPI?.resizeWindow(w, h);
      }
      setView('blur-preview');
    });
    const handleFocus = async () => {
      const data = await window.electronAPI?.getPendingSnip();
      if (data) { setSnipImage(data); setView('editor'); }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  useEffect(() => {
    if (!window.electronAPI?.resizeWindow) return;
    if (view === 'main') {
      window.electronAPI.resizeWindow(MAIN_WIDTH, MAIN_HEIGHT);
      return;
    }
    if (view === 'settings' || view === 'result' || view === 'editor') {
      window.electronAPI.resizeWindow(MAIN_WIDTH, DETAIL_HEIGHT);
    }
  }, [view]);

  useEffect(() => {
    const stored = localStorage.getItem('openrouter-api-key');
    if (stored) setApiKey(stored);
    setSelectedModel(localStorage.getItem('ocr-model') || '');
    setCorrectionModel(localStorage.getItem('correction-model') || 'nvidia/nemotron-3-super-120b-a12b:free');
    setCorrectionEnabled(localStorage.getItem('correction-enabled') !== 'false');
    const cached = localStorage.getItem('ocr-models-cache');
    if (cached) { try { setModels(JSON.parse(cached)); } catch {} }
    const cachedText = localStorage.getItem('text-models-cache');
    if (cachedText) { try { setTextModels(JSON.parse(cachedText)); } catch {} }
  }, []);

  async function fetchModels() {
    setModelsLoading(true);
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models');
      const data = await res.json();
      const allModels = data.data || [];
      const visionModels: OCRModel[] = allModels
        .filter((m: any) => (m.architecture?.input_modalities || []).includes('image'))
        .map((m: any) => ({ id: m.id, name: m.name || m.id, free: m.pricing?.prompt === '0' && m.pricing?.completion === '0' }))
        .sort((a: OCRModel, b: OCRModel) => { if (a.free !== b.free) return a.free ? -1 : 1; return a.name.localeCompare(b.name); });
      const txtModels: TextModel[] = allModels
        .filter((m: any) => (m.architecture?.input_modalities || []).includes('text'))
        .map((m: any) => ({ id: m.id, name: m.name || m.id, free: m.pricing?.prompt === '0' && m.pricing?.completion === '0' }))
        .sort((a: TextModel, b: TextModel) => { if (a.free !== b.free) return a.free ? -1 : 1; return a.name.localeCompare(b.name); });
      setModels(visionModels);
      setTextModels(txtModels);
      localStorage.setItem('ocr-models-cache', JSON.stringify(visionModels));
      localStorage.setItem('text-models-cache', JSON.stringify(txtModels));
    } catch (err) { console.error('Failed to fetch models:', err); }
    finally { setModelsLoading(false); }
  }

  // --- Titlebar (shared) ---
  const titlebar = (title: string, showBack?: () => void, extra?: React.ReactNode) => (
    <div className="titlebar">
      {showBack && <button className="back-btn" aria-label="Back" onClick={showBack}>&larr;</button>}
      <span className="title">{title}</span>
      {extra}
      <div className="titlebar-spacer" />
      <div className="titlebar-controls">
        <div className="toggle-group">
          <button className={`toggle-btn ${lang === 'tr' ? 'active' : ''}`} onClick={() => changeLang('tr')}>TR</button>
          <button className={`toggle-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => changeLang('en')}>EN</button>
        </div>
        <div className="toggle-group">
          <button className={`toggle-btn ${theme === 'dark' ? 'active' : ''}`} aria-label="Dark theme" onClick={() => changeTheme('dark')}>&#9790;</button>
          <button className={`toggle-btn ${theme === 'light' ? 'active' : ''}`} aria-label="Light theme" onClick={() => changeTheme('light')}>&#9788;</button>
        </div>
        <button className="win-btn" aria-label="Minimize window" onClick={() => window.electronAPI?.minimizeWindow()}>&#8722;</button>
        <button className="win-btn win-close" aria-label="Close window" onClick={() => window.electronAPI?.closeWindow()}>&#10005;</button>
      </div>
    </div>
  );


  const currentModel = models.find(m => m.id === selectedModel);
  const currentCorr = textModels.find(m => m.id === correctionModel);
  const currentModelName = currentModel?.name;
  const statusBar = (
    <div className="status-bar">
      <span className="status-dot" aria-hidden="true" />
      <span>{currentModelName ? currentModelName.split(' ').slice(0, 3).join(' ') : T('main.noModel')}</span>
      <span className="status-sep">|</span>
      <span>{T('app.hotkey')}</span>
    </div>
  );

  if (view === 'settings') {
    return (
      <Settings
        lang={lang} T={T} titlebar={titlebar} statusBar={statusBar}
        apiKey={apiKey} selectedModel={selectedModel} correctionModel={correctionModel}
        correctionEnabled={correctionEnabled} models={models} textModels={textModels}
        modelsLoading={modelsLoading} onFetchModels={fetchModels}
        onSave={(key, model, corrModel, corrEnabled) => {
          setApiKey(key); setSelectedModel(model); setCorrectionModel(corrModel); setCorrectionEnabled(corrEnabled);
          localStorage.setItem('openrouter-api-key', key); localStorage.setItem('ocr-model', model);
          localStorage.setItem('correction-model', corrModel); localStorage.setItem('correction-enabled', String(corrEnabled));
          setView('main');
        }}
        onBack={() => setView('main')}
      />
    );
  }

  if (view === 'editor' && snipImage) {
    return <Editor imageBase64={snipImage} onClose={() => setView('main')} lang={lang} T={T} />;
  }

  if (view === 'blur-preview' && blurImage) {
    return (
      <div className="main-container">
        {titlebar(T('blur.title'), () => setView('main'))}
        <div className="content" style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', maxWidth: '100%', maxHeight: 'calc(100vh - 150px)' }}>
            <img
              src={`data:image/png;base64,${blurImage}`}
              style={{ display: 'block', maxWidth: '100%', maxHeight: 'calc(100vh - 150px)', objectFit: 'contain' }}
            />
          </div>
        </div>
        <div className="editor-actions">
          <button className="btn secondary" onClick={() => { setView('main'); setBlurImage(null); window.electronAPI?.resizeWindow(MAIN_WIDTH, MAIN_HEIGHT); }}>
            {T('blur.cancel')}
          </button>
          <button className="btn secondary" onClick={() => { setBlurImage(null); window.electronAPI?.resizeWindow(MAIN_WIDTH, MAIN_HEIGHT); window.electronAPI?.startBlurCapture(); }}>
            {T('blur.retake')}
          </button>
          <button className="btn primary" onClick={async () => {
            const saved = await window.electronAPI?.saveBlur(blurImage);
            if (saved) setBlurSaved(true);
          }}>
            {blurSaved ? T('blur.saved') : T('blur.save')}
          </button>
        </div>
      </div>
    );
  }

  if (view === 'result') {
    return (
      <ResultPanel
        lang={lang} T={T} titlebar={titlebar} statusBar={statusBar}
        result={result} loading={loading}
        onCopy={() => result && window.electronAPI?.copyToClipboard(result.fullText)}
        onRescan={() => capturedImage && runOCR(capturedImage)}
        onBack={() => setView('main')}
      />
    );
  }


  return (
    <div className="main-container">
      {titlebar(T('app.title'), undefined, <span className="hotkey-hint">{T('app.hotkey')}</span>)}

      <div className="content compact dashboard">
        <div className="capture-cluster">
          <button className="btn primary action-main" onClick={() => window.electronAPI?.startCapture()}>
            <span className="icon" aria-hidden="true">&#9634;</span>
            <span className="action-texts">
              <span className="action-label">{T('main.selectArea')}</span>
              <span className="action-meta">{T('app.hotkey')}</span>
            </span>
          </button>

          <div className="quick-row">
            <button className="btn secondary action-quick" onClick={() => window.electronAPI?.startSnipCapture()}>
              <span className="icon" aria-hidden="true">&#9998;</span>
              <span className="action-label">{T('main.snipEdit')}</span>
            </button>
            <button className="btn secondary action-quick" onClick={() => window.electronAPI?.startBlurCapture()}>
              <span className="icon" aria-hidden="true">&#128065;</span>
              <span className="action-label">{T('main.blurCapture')}</span>
            </button>
            <button className="btn secondary action-quick" onClick={() => window.electronAPI?.startBlurFromFile?.()}>
              <span className="icon" aria-hidden="true">&#128247;</span>
              <span className="action-label">{T('main.blurFromFile')}</span>
            </button>
          </div>

          <div className="quick-row">
            <button className="btn secondary action-quick" onClick={async () => {
              const img = await window.electronAPI?.getClipboardImage();
              if (img) { setCapturedImage(img); await runOCR(img); }
            }}>
              <span className="icon" aria-hidden="true">&#128203;</span>
              <span className="action-label">{T('main.scanClipboard')}</span>
            </button>
            <button className="btn secondary action-quick" onClick={async () => {
              const img = await window.electronAPI?.openImageFile?.();
              if (img) { setSnipImage(img); setView('editor'); }
            }}>
              <span className="icon" aria-hidden="true">&#128193;</span>
              <span className="action-label">{T('main.openFile')}</span>
            </button>
          </div>
        </div>

        <div className="models-stack">
          <div className="model-info">
            <span className="label">OCR</span>
            <span className="name">{currentModel?.name || T('main.noModel')}</span>
            {currentModel?.free && <span className="free-badge">{T('main.free')}</span>}
            {currentModel && !currentModel.free && <span className="paid-badge">{T('main.paid')}</span>}
          </div>

          {correctionEnabled && (
            <div className="model-info">
              <span className="label">FIX</span>
              <span className="name">{currentCorr?.name || correctionModel || T('main.noModel')}</span>
              {currentCorr?.free && <span className="free-badge">{T('main.free')}</span>}
              {currentCorr && !currentCorr.free && <span className="paid-badge">{T('main.paid')}</span>}
            </div>
          )}
        </div>

        <div className="utility-row">
          <button className={`btn outline utility-btn ${!result ? 'full' : ''}`} onClick={() => setView('settings')}>
            <span className="icon" aria-hidden="true">&#9881;</span> {T('main.settings')}
          </button>

          {result && (
            <button className="btn outline utility-btn" onClick={() => setView('result')}>
              <span className="icon" aria-hidden="true">&#128196;</span> {T('main.lastResult')}
            </button>
          )}
        </div>

        {!apiKey && <div className="warning">{T('main.noApiKey')}</div>}
        {apiKey && !selectedModel && <div className="warning">{T('main.noModel')}</div>}
      </div>

      <div className="main-footer">
        {statusBar}
      </div>
    </div>
  );
}
