import Store from 'electron-store';

interface Settings {
  apiKey: string;
  freeFirst: boolean;
  hotkey: string;
  autoCopy: boolean;
  preprocessEnabled: boolean;
  outputLanguage: string;
}

const store = new Store<Settings>({
  defaults: {
    apiKey: '',
    freeFirst: true,
    hotkey: 'CommandOrControl+Shift+X',
    autoCopy: true,
    preprocessEnabled: true,
    outputLanguage: 'auto',
  },
  encryptionKey: 'screen-ocr-app-v1',
});

export function getSettings(): Settings {
  return {
    apiKey: store.get('apiKey'),
    freeFirst: store.get('freeFirst'),
    hotkey: store.get('hotkey'),
    autoCopy: store.get('autoCopy'),
    preprocessEnabled: store.get('preprocessEnabled'),
    outputLanguage: store.get('outputLanguage'),
  };
}

export function setSetting<K extends keyof Settings>(key: K, value: Settings[K]): void {
  store.set(key, value);
}

export function getApiKey(): string {
  return store.get('apiKey');
}
