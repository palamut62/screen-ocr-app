import React, { useState } from 'react';
import type { Lang, TranslationKey } from './i18n';

interface OCRResult {
  fullText: string;
  language: string;
  confidence: number;
  containsHandwriting: boolean;
  modelUsed: string;
  corrected?: boolean;
  correcting?: boolean;
}

interface Props {
  lang: Lang;
  T: (key: TranslationKey) => string;
  titlebar: (title: string, showBack?: () => void, extra?: React.ReactNode) => React.ReactNode;
  statusBar: React.ReactNode;
  result: OCRResult | null;
  loading: boolean;
  onCopy: () => void;
  onRescan: () => void;
  onBack: () => void;
}

export default function ResultPanel({ lang, T, titlebar, statusBar, result, loading, onCopy, onRescan, onBack }: Props) {
  const [showJson, setShowJson] = useState(false);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loading) {
    return (
      <div className="main-container">
        {titlebar(T('result.title'), onBack)}
        <div className="loading">
          <div className="spinner"></div>
          <p style={{ color: 'var(--text-dim)', fontSize: 13 }}>{T('result.extracting')}</p>
        </div>
        {statusBar}
      </div>
    );
  }

  if (!result) return null;

  return (
    <div className="main-container">
      {titlebar(T('result.title'), onBack, <span className="model-badge">{result.modelUsed}</span>)}
      <div className="content">
        <div className="result-content">
          {showJson ? (
            <pre className="json-view">{JSON.stringify(result, null, 2)}</pre>
          ) : (
            <div className="text-view">{result.fullText || 'No text detected.'}</div>
          )}
        </div>

        <div className="result-meta">
          <span>{T('result.confidence')}: {Math.round(result.confidence * 100)}%</span>
          <span>{T('result.language')}: {result.language}</span>
          {result.containsHandwriting && <span className="badge">{T('result.handwriting')}</span>}
          {result.correcting && <span className="badge correcting">{T('result.correcting')}</span>}
          {result.corrected && <span className="badge corrected">{T('result.corrected')}</span>}
        </div>

        <div className="result-actions">
          <button className="btn primary" onClick={handleCopy}>
            {copied ? T('result.copied') : T('result.copy')}
          </button>
          <button className="btn secondary" onClick={onRescan}>{T('result.rescan')}</button>
          <button className="btn outline" onClick={() => setShowJson(!showJson)}>
            {showJson ? 'Text' : 'JSON'}
          </button>
        </div>
      </div>
      {statusBar}
    </div>
  );
}
