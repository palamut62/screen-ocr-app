import React, { useState, useEffect } from 'react';
import type { OCRModel, TextModel } from './app';
import type { Lang, TranslationKey } from './i18n';

interface Props {
  lang: Lang;
  T: (key: TranslationKey) => string;
  titlebar: (title: string, showBack?: () => void, extra?: React.ReactNode) => React.ReactNode;
  statusBar: React.ReactNode;
  apiKey: string;
  selectedModel: string;
  correctionModel: string;
  correctionEnabled: boolean;
  models: OCRModel[];
  textModels: TextModel[];
  modelsLoading: boolean;
  onFetchModels: () => void;
  onSave: (key: string, model: string, corrModel: string, corrEnabled: boolean) => void;
  onBack: () => void;
}

export default function Settings({
  lang, T, titlebar, statusBar,
  apiKey, selectedModel, correctionModel, correctionEnabled,
  models, textModels, modelsLoading, onFetchModels, onSave, onBack,
}: Props) {
  const [key, setKey] = useState(apiKey);
  const [model, setModel] = useState(selectedModel);
  const [corrModel, setCorrModel] = useState(correctionModel);
  const [corrEnabled, setCorrEnabled] = useState(correctionEnabled);
  const [autoCopy, setAutoCopy] = useState(() => localStorage.getItem('auto-copy') !== 'false');
  const [autoLaunch, setAutoLaunch] = useState(true);
  const [filter, setFilter] = useState<'all' | 'free' | 'paid'>('all');

  useEffect(() => {
    window.electronAPI?.getAutoLaunch?.().then((v: boolean) => setAutoLaunch(v));
  }, []);
  const [search, setSearch] = useState('');
  const [corrFilter, setCorrFilter] = useState<'all' | 'free' | 'paid'>('all');
  const [corrSearch, setCorrSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'ocr' | 'correction'>('ocr');

  function handleSave() {
    localStorage.setItem('auto-copy', String(autoCopy));
    onSave(key, model, corrModel, corrEnabled);
  }

  const filtered = models.filter(m => {
    if (filter === 'free' && !m.free) return false;
    if (filter === 'paid' && m.free) return false;
    if (search && !m.name.toLowerCase().includes(search.toLowerCase()) && !m.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const filteredCorr = textModels.filter(m => {
    if (corrFilter === 'free' && !m.free) return false;
    if (corrFilter === 'paid' && m.free) return false;
    if (corrSearch && !m.name.toLowerCase().includes(corrSearch.toLowerCase()) && !m.id.toLowerCase().includes(corrSearch.toLowerCase())) return false;
    return true;
  });

  const freeCount = models.filter(m => m.free).length;
  const paidCount = models.filter(m => !m.free).length;
  const corrFreeCount = textModels.filter(m => m.free).length;
  const corrPaidCount = textModels.filter(m => !m.free).length;

  return (
    <div className="main-container">
      {titlebar(T('settings.title'), onBack)}

      <div className="settings-form">
        <div className="form-group">
          <label>{T('settings.apiKey')}</label>
          <input type="password" value={key} onChange={(e) => setKey(e.target.value)} placeholder={T('settings.apiKeyPlaceholder')} />
        </div>

        <div className="settings-tabs">
          <button className={`settings-tab ${activeTab === 'ocr' ? 'active' : ''}`} onClick={() => setActiveTab('ocr')}>
            {T('settings.ocrTab')}
          </button>
          <button className={`settings-tab ${activeTab === 'correction' ? 'active' : ''}`} onClick={() => setActiveTab('correction')}>
            {T('settings.correctionTab')}
          </button>
        </div>

        {activeTab === 'ocr' && (
          <div className="form-group">
            <label>
              {T('settings.ocrTab')} <span className="model-count">{models.length > 0 ? `(${models.length})` : ''}</span>
            </label>
            <div className="model-toolbar">
              <button className="btn secondary sm" onClick={onFetchModels} disabled={modelsLoading}>
                {modelsLoading ? '...' : models.length > 0 ? T('settings.refresh') : T('settings.fetchModels')}
              </button>
              {models.length > 0 && (
                <div className="filter-tabs">
                  <button className={`tab ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>{T('settings.all')} ({models.length})</button>
                  <button className={`tab ${filter === 'free' ? 'active' : ''}`} onClick={() => setFilter('free')}>{T('main.free')} ({freeCount})</button>
                  <button className={`tab ${filter === 'paid' ? 'active' : ''}`} onClick={() => setFilter('paid')}>{T('main.paid')} ({paidCount})</button>
                </div>
              )}
            </div>
            {models.length > 0 && (
              <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={T('settings.search')} className="model-search" />
            )}
            <div className="model-list">
              {models.length === 0 && !modelsLoading && <div className="model-empty">{T('settings.fetchModels')}</div>}
              {modelsLoading && <div className="model-empty"><div className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }}></div></div>}
              {filtered.map((m) => (
                <label key={m.id} className={`model-option ${model === m.id ? 'active' : ''}`}>
                  <input type="radio" name="ocrmodel" value={m.id} checked={model === m.id} onChange={() => setModel(m.id)} />
                  <span className="model-option-name">{m.name}</span>
                  {m.free ? <span className="free-badge">FREE</span> : <span className="paid-badge">PAID</span>}
                </label>
              ))}
              {models.length > 0 && filtered.length === 0 && <div className="model-empty">No match</div>}
            </div>
          </div>
        )}

        {activeTab === 'correction' && (
          <div className="form-group">
            <label>
              <input type="checkbox" checked={corrEnabled} onChange={(e) => setCorrEnabled(e.target.checked)} />
              {T('settings.enableCorrection')}
            </label>
            <small>{T('settings.correctionHelp')}</small>

            {corrEnabled && (
              <>
                <label style={{ marginTop: 6 }}>
                  {T('settings.correctionTab')} <span className="model-count">{textModels.length > 0 ? `(${textModels.length})` : ''}</span>
                </label>
                <div className="model-toolbar">
                  <button className="btn secondary sm" onClick={onFetchModels} disabled={modelsLoading}>
                    {modelsLoading ? '...' : textModels.length > 0 ? T('settings.refresh') : T('settings.fetchModels')}
                  </button>
                  {textModels.length > 0 && (
                    <div className="filter-tabs">
                      <button className={`tab ${corrFilter === 'all' ? 'active' : ''}`} onClick={() => setCorrFilter('all')}>{T('settings.all')} ({textModels.length})</button>
                      <button className={`tab ${corrFilter === 'free' ? 'active' : ''}`} onClick={() => setCorrFilter('free')}>{T('main.free')} ({corrFreeCount})</button>
                      <button className={`tab ${corrFilter === 'paid' ? 'active' : ''}`} onClick={() => setCorrFilter('paid')}>{T('main.paid')} ({corrPaidCount})</button>
                    </div>
                  )}
                </div>
                {textModels.length > 0 && (
                  <input type="text" value={corrSearch} onChange={(e) => setCorrSearch(e.target.value)} placeholder={T('settings.search')} className="model-search" />
                )}
                <div className="model-list">
                  {textModels.length === 0 && !modelsLoading && <div className="model-empty">{T('settings.fetchModels')}</div>}
                  {filteredCorr.map((m) => (
                    <label key={m.id} className={`model-option ${corrModel === m.id ? 'active' : ''}`}>
                      <input type="radio" name="corrmodel" value={m.id} checked={corrModel === m.id} onChange={() => setCorrModel(m.id)} />
                      <span className="model-option-name">{m.name}</span>
                      {m.free ? <span className="free-badge">FREE</span> : <span className="paid-badge">PAID</span>}
                    </label>
                  ))}
                  {textModels.length > 0 && filteredCorr.length === 0 && <div className="model-empty">No match</div>}
                </div>
              </>
            )}
          </div>
        )}

        <div className="form-group">
          <label>
            <input type="checkbox" checked={autoLaunch} onChange={async (e) => {
              const val = e.target.checked;
              setAutoLaunch(val);
              await window.electronAPI?.setAutoLaunch?.(val);
            }} />
            {T('settings.autoLaunch')}
          </label>
        </div>

        <div className="form-group">
          <label>
            <input type="checkbox" checked={autoCopy} onChange={(e) => setAutoCopy(e.target.checked)} />
            {T('settings.autoCopy')}
          </label>
        </div>

        <div className="form-group">
          <label>{T('settings.globalHotkey')}</label>
          <input type="text" value="Ctrl+Shift+X" disabled />
        </div>

        <button className="btn primary" onClick={handleSave}>{T('settings.save')}</button>
      </div>
      {statusBar}
    </div>
  );
}
