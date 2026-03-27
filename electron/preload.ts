import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  startCapture: () => ipcRenderer.invoke('start-capture'),
  onCaptureComplete: (callback: (base64: string) => void) => {
    ipcRenderer.removeAllListeners('capture-complete');
    ipcRenderer.on('capture-complete', (_event, base64) => callback(base64));
  },
  regionSelected: (region: { x: number; y: number; width: number; height: number }) =>
    ipcRenderer.invoke('region-selected', region),
  cancelCapture: () => ipcRenderer.invoke('cancel-capture'),
  copyToClipboard: (text: string) => ipcRenderer.invoke('copy-to-clipboard', text),
  getClipboardImage: () => ipcRenderer.invoke('get-clipboard-image'),
  minimizeWindow: () => ipcRenderer.invoke('minimize-window'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  getAutoLaunch: () => ipcRenderer.invoke('get-auto-launch'),
  setAutoLaunch: (enabled: boolean) => ipcRenderer.invoke('set-auto-launch', enabled),
  resizeWindow: (w: number, h: number) => ipcRenderer.invoke('resize-window', w, h),
  getScreenSize: () => ipcRenderer.invoke('get-screen-size'),
  startSnipCapture: () => ipcRenderer.invoke('start-snip-capture'),
  onSnipComplete: (callback: (base64: string) => void) => {
    ipcRenderer.removeAllListeners('snip-complete');
    ipcRenderer.on('snip-complete', (_event, base64) => callback(base64));
  },
  getPendingSnip: () => ipcRenderer.invoke('get-pending-snip'),
  copyImage: (base64: string) => ipcRenderer.invoke('copy-image', base64),
  saveSnip: (base64: string) => ipcRenderer.invoke('save-snip', base64),
  startBlurCapture: () => ipcRenderer.invoke('start-blur-capture'),
  onBlurPreview: (callback: (base64: string) => void) => {
    ipcRenderer.removeAllListeners('blur-preview');
    ipcRenderer.on('blur-preview', (_event, base64) => callback(base64));
  },
  saveBlur: (base64: string) => ipcRenderer.invoke('save-blur', base64),
  editorClosed: () => ipcRenderer.invoke('editor-closed'),
  openImageFile: () => ipcRenderer.invoke('open-image-file'),
  fetchImageUrl: (url: string) => ipcRenderer.invoke('fetch-image-url', url),
  saveImageFormat: (base64: string, format: 'png' | 'jpeg' | 'webp', quality: number) =>
    ipcRenderer.invoke('save-image-format', base64, format, quality),
});
