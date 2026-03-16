import React, { useState, useEffect, useRef, useCallback } from 'react';
import ResultPanel from './result-panel';
import Settings from './settings';
import Editor from './editor';
import { type Lang, type TranslationKey, t, getStoredLang, setStoredLang } from './i18n';
import { type Theme, getStoredTheme, setStoredTheme, applyTheme } from './theme';

type View = 'main' | 'result' | 'settings' | 'editor';

interface OCRResult {
  fullText: string;
  language: string;
  confidence: number;
  containsHandwriting: boolean;
  modelUsed: string;
  corrected?: boolean;
  correcting?: boolean;
}

export interface OCRModel { id: string; name: string; free: boolean; }
export interface TextModel { id: string; name: string; free: boolean; }

async function correctText(key: string, model: string, rawText: string): Promise<string | null> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: `You are an OCR text correction engine. Fix ONLY character-level OCR errors (wrong letters, missing/extra characters, broken Unicode). Do NOT change meaning, formatting, line breaks, or translate. If the text looks correct, return it unchanged. Return ONLY the corrected text, nothing else.` },
          { role: 'user', content: rawText },
        ],
        max_tokens: 4096,
        temperature: 0,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

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
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: `You are an OCR engine specialized in multilingual screen text extraction.\nExtract every visible text exactly as written.\nRules: support printed and handwritten text, preserve line breaks, do not summarize, do not translate, keep punctuation exactly.\nReturn ONLY valid JSON: {"fullText":"...","language":"auto","confidence":0.87,"containsHandwriting":false}` },
            { role: 'user', content: [
              { type: 'text', text: 'Extract all visible text from this image. Return ONLY JSON.' },
              { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
            ] },
          ],
          max_tokens: 4096,
          temperature: 0,
        }),
      });

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || '';
      let jsonStr = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) jsonStr = jsonMatch[1];

      const cachedModels: OCRModel[] = JSON.parse(localStorage.getItem('ocr-models-cache') || '[]');
      const modelInfo = cachedModels.find(m => m.id === model);
      const parsed = JSON.parse(jsonStr.trim());
      const ocrResult: OCRResult = {
        fullText: parsed.fullText || content,
        language: parsed.language || 'unknown',
        confidence: parsed.confidence || 0,
        containsHandwriting: parsed.containsHandwriting || false,
        modelUsed: modelInfo?.name || model,
        correcting: corrEnabled && !!corrModel,
      };

      setResult(ocrResult);
      setLoading(false);

      const autoCopy = localStorage.getItem('auto-copy') !== 'false';
      if (autoCopy && ocrResult.fullText) window.electronAPI?.copyToClipboard(ocrResult.fullText);

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
    const handleFocus = async () => {
      const data = await window.electronAPI?.getPendingSnip();
      if (data) { setSnipImage(data); setView('editor'); }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

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
      {showBack && <button className="back-btn" onClick={showBack}>&larr;</button>}
      <span className="title">{title}</span>
      {extra}
      <div className="titlebar-spacer" />
      <div className="titlebar-controls">
        <div className="toggle-group">
          <button className={`toggle-btn ${lang === 'tr' ? 'active' : ''}`} onClick={() => changeLang('tr')}>TR</button>
          <button className={`toggle-btn ${lang === 'en' ? 'active' : ''}`} onClick={() => changeLang('en')}>EN</button>
        </div>
        <div className="toggle-group">
          <button className={`toggle-btn ${theme === 'dark' ? 'active' : ''}`} onClick={() => changeTheme('dark')}>&#9790;</button>
          <button className={`toggle-btn ${theme === 'light' ? 'active' : ''}`} onClick={() => changeTheme('light')}>&#9788;</button>
        </div>
        <button className="win-btn" onClick={() => window.electronAPI?.minimizeWindow()}>&#8722;</button>
        <button className="win-btn win-close" onClick={() => window.electronAPI?.closeWindow()}>&#10005;</button>
      </div>
    </div>
  );

  const currentModel = models.find(m => m.id === selectedModel);
  const currentCorr = textModels.find(m => m.id === correctionModel);
  const currentModelName = currentModel?.name;
  const statusBar = (
    <div className="status-bar">
      <span className="status-dot" />
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

      {/* Main content - no flex grow, just natural height */}
      <div className="content compact">
        <div className="action-grid">
          <button className="btn primary" onClick={() => window.electronAPI?.startCapture()}>
            <span className="icon">&#9634;</span>
            {T('main.selectArea')}
          </button>
          <button className="btn secondary" onClick={() => window.electronAPI?.startSnipCapture()}>
            <span className="icon">&#9998;</span>
            {T('main.snipEdit')}
          </button>
          <button className="btn secondary full" onClick={async () => {
            const img = await window.electronAPI?.getClipboardImage();
            if (img) { setCapturedImage(img); await runOCR(img); }
          }}>
            <span className="icon">&#128203;</span>
            {T('main.scanClipboard')}
          </button>
        </div>

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

        {result && (
          <button className="btn outline" onClick={() => setView('result')}>
            <span className="icon">&#128196;</span> {T('main.lastResult')}
          </button>
        )}

        {!apiKey && <div className="warning">{T('main.noApiKey')}</div>}
        {apiKey && !selectedModel && <div className="warning">{T('main.noModel')}</div>}
      </div>

      {/* Spacer pushes footer down */}
      <div style={{ flex: 1 }} />

      {/* Footer: settings button + status bar */}
      <div className="main-footer">
        <button className="footer-settings-btn" onClick={() => setView('settings')}>
          <span>&#9881;</span> {T('main.settings')}
        </button>
        {statusBar}
      </div>
    </div>
  );
}
