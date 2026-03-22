import { app, BrowserWindow, globalShortcut, ipcMain, clipboard, screen, Tray, Menu, nativeImage, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { captureScreen, captureRegion, optimizeForOCR, createMultiRegionBlur } from './capture';
import { createOverlayWindow, createMultiRegionOverlay } from './overlay-window';

// Fix Windows fullscreen occlusion detection
app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion');

let mainWindow: BrowserWindow | null = null;
let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const isDev = !app.isPackaged;

function createTray() {
  const iconPath = isDev
    ? path.join(__dirname, '..', '..', 'assets', 'tray-icon.png')
    : path.join(process.resourcesPath, 'assets', 'tray-icon.png');
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  tray = new Tray(icon);
  tray.setToolTip('Screen OCR');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show', click: () => { mainWindow?.show(); mainWindow?.focus(); } },
    { label: 'Capture (Ctrl+Shift+X)', click: () => startCapture() },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.quit(); } },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('double-click', () => {
    mainWindow?.show();
    mainWindow?.focus();
  });
}

function createMainWindow() {
  const appIconPath = isDev
    ? path.join(__dirname, '..', '..', 'assets', 'icon.ico')
    : path.join(process.resourcesPath, 'assets', 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 400,
    height: 500,
    resizable: false,
    frame: false,
    transparent: false,
    icon: appIconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Minimize to tray instead of closing
  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

async function startCapture() {
  if (overlayWindow) return;

  mainWindow?.hide();

  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const scaleFactor = primaryDisplay.scaleFactor;

    const screenshotPath = await captureScreen();
    overlayWindow = createOverlayWindow(width, height, scaleFactor, screenshotPath);

    overlayWindow.on('closed', () => {
      overlayWindow = null;
      mainWindow?.show();
    });
  } catch (err) {
    console.error('Screen capture failed:', err);
    mainWindow?.show();
  }
}

// IPC Handlers
ipcMain.handle('start-capture', () => {
  startCapture();
});

ipcMain.handle('region-selected', async (_event, regionOrRegions: any) => {
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const sf = primaryDisplay.scaleFactor;
    const screenW = Math.round(primaryDisplay.bounds.width * sf);
    const screenH = Math.round(primaryDisplay.bounds.height * sf);

    function scaleRegion(region: { x: number; y: number; width: number; height: number }) {
      let sx = Math.round(region.x * sf);
      let sy = Math.round(region.y * sf);
      let sw = Math.round(region.width * sf);
      let sh = Math.round(region.height * sf);
      sx = Math.max(0, Math.min(sx, screenW - 1));
      sy = Math.max(0, Math.min(sy, screenH - 1));
      sw = Math.min(sw, screenW - sx);
      sh = Math.min(sh, screenH - sy);
      return { x: sx, y: sy, width: sw, height: sh };
    }

    overlayWindow?.close();
    overlayWindow = null;
    mainWindow?.show();

    // Multi-region blur mode (array of regions)
    if (blurMode && Array.isArray(regionOrRegions)) {
      const scaledRegions = regionOrRegions.map(scaleRegion).filter((r: any) => r.width > 0 && r.height > 0);
      const blurredBuffer = await createMultiRegionBlur(scaledRegions);
      blurMode = false;
      const base64 = blurredBuffer.toString('base64');
      mainWindow?.webContents.send('blur-preview', base64);
      return base64;
    }

    // Single region (legacy blur or normal capture)
    const region = Array.isArray(regionOrRegions) ? regionOrRegions[0] : regionOrRegions;
    const scaledRegion = scaleRegion(region);
    if (scaledRegion.width < 1 || scaledRegion.height < 1) throw new Error('Selection too small');

    const imageBuffer = await captureRegion(scaledRegion);

    if (blurMode) {
      const blurredBuffer = await createMultiRegionBlur([scaledRegion]);
      blurMode = false;
      const base64 = blurredBuffer.toString('base64');
      mainWindow?.webContents.send('blur-preview', base64);
      return base64;
    } else if (snipMode) {
      const base64 = imageBuffer.toString('base64');
      console.log('[SNIP] base64 length:', base64.length);
      pendingSnipBase64 = base64;
      mainWindow?.webContents.send('snip-complete', base64);
      snipMode = false;
      return base64;
    } else {
      const base64 = await optimizeForOCR(imageBuffer);
      mainWindow?.webContents.send('capture-complete', base64);
      return base64;
    }
  } catch (err) {
    console.error('Region capture failed:', err);
    overlayWindow?.close();
    overlayWindow = null;
    mainWindow?.show();
    return null;
  }
});

ipcMain.handle('cancel-capture', () => {
  overlayWindow?.close();
  overlayWindow = null;
  snipMode = false;
  blurMode = false;
  mainWindow?.show();
});

ipcMain.handle('start-blur-capture', async () => {
  if (overlayWindow) return;
  blurMode = true;
  mainWindow?.hide();
  try {
    const primaryDisplay = screen.getPrimaryDisplay();
    const { width, height } = primaryDisplay.size;
    const scaleFactor = primaryDisplay.scaleFactor;
    const screenshotPath = await captureScreen();
    overlayWindow = createMultiRegionOverlay(
      screenshotPath,
      () => {},
      () => {},
    );
    overlayWindow.on('closed', () => {
      overlayWindow = null;
      mainWindow?.show();
    });
  } catch (err) {
    console.error('Blur capture failed:', err);
    blurMode = false;
    mainWindow?.show();
  }
});

ipcMain.handle('copy-to-clipboard', (_event, text: string) => {
  clipboard.writeText(text);
});

ipcMain.handle('get-clipboard-image', async () => {
  const image = clipboard.readImage();
  if (image.isEmpty()) return null;
  const pngBuffer = image.toPNG();
  // Optimize clipboard image too
  return optimizeForOCR(pngBuffer);
});

ipcMain.handle('minimize-window', () => {
  mainWindow?.minimize();
});

ipcMain.handle('close-window', () => {
  mainWindow?.hide();
});

// Snip capture — same overlay, but sends raw image to editor instead of OCR
let snipMode = false;
let blurMode = false;
let pendingSnipBase64: string | null = null;

ipcMain.handle('resize-window', (_event, width: number, height: number) => {
  if (!mainWindow) return;
  mainWindow.setResizable(true);
  mainWindow.setSize(width, height);
  mainWindow.center();
});

ipcMain.handle('get-auto-launch', () => {
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('set-auto-launch', (_event, enabled: boolean) => {
  app.setLoginItemSettings({ openAtLogin: enabled });
  return app.getLoginItemSettings().openAtLogin;
});

ipcMain.handle('get-screen-size', () => {
  const { workAreaSize } = screen.getPrimaryDisplay();
  return { width: workAreaSize.width, height: workAreaSize.height };
});

ipcMain.handle('start-snip-capture', () => {
  snipMode = true;
  startCapture();
});

ipcMain.handle('get-pending-snip', () => {
  const data = pendingSnipBase64;
  pendingSnipBase64 = null;
  return data;
});

ipcMain.handle('copy-image', (_event, base64: string) => {
  const buf = Buffer.from(base64, 'base64');
  const img = nativeImage.createFromBuffer(buf);
  clipboard.writeImage(img);
});

ipcMain.handle('save-blur', async (_event, base64: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: `blur-capture-${Date.now()}.png`,
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });
  if (result.canceled || !result.filePath) return null;
  const buf = Buffer.from(base64, 'base64');
  fs.writeFileSync(result.filePath, buf);
  return result.filePath;
});

ipcMain.handle('save-snip', async (_event, base64: string) => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    defaultPath: `snip-${Date.now()}.png`,
    filters: [{ name: 'PNG Image', extensions: ['png'] }],
  });
  if (result.canceled || !result.filePath) return null;
  const buf = Buffer.from(base64, 'base64');
  fs.writeFileSync(result.filePath, buf);
  return result.filePath;
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.whenReady().then(() => {
  // Enable auto-launch by default on first run (production only)
  if (!isDev) {
    const settings = app.getLoginItemSettings();
    const firstRunKey = 'auto-launch-initialized';
    const configPath = path.join(app.getPath('userData'), firstRunKey);
    if (!fs.existsSync(configPath)) {
      app.setLoginItemSettings({ openAtLogin: true });
      fs.writeFileSync(configPath, '1');
    }
  }

  createTray();
  createMainWindow();

  globalShortcut.register('CommandOrControl+Shift+X', () => {
    startCapture();
  });
});

app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

app.on('window-all-closed', () => {
  // Don't quit — tray keeps running
});
