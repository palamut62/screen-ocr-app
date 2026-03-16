interface ElectronAPI {
  startCapture: () => Promise<void>;
  onCaptureComplete: (callback: (base64: string) => void) => void;
  regionSelected: (region: { x: number; y: number; width: number; height: number }) => Promise<string | null>;
  cancelCapture: () => Promise<void>;
  copyToClipboard: (text: string) => Promise<void>;
  getClipboardImage: () => Promise<string | null>;
  minimizeWindow: () => Promise<void>;
  closeWindow: () => Promise<void>;
  getAutoLaunch: () => Promise<boolean>;
  setAutoLaunch: (enabled: boolean) => Promise<boolean>;
  resizeWindow: (w: number, h: number) => Promise<void>;
  getScreenSize: () => Promise<{ width: number; height: number }>;
  startSnipCapture: () => Promise<void>;
  onSnipComplete: (callback: (base64: string) => void) => void;
  getPendingSnip: () => Promise<string | null>;
  copyImage: (base64: string) => Promise<void>;
  saveSnip: (base64: string) => Promise<string | null>;
}

interface Window {
  electronAPI: ElectronAPI;
}
