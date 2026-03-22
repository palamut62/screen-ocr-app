import { BrowserWindow, screen, ipcMain } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export function createOverlayWindow(
  _width: number,
  _height: number,
  _scaleFactor: number,
  screenshotPath: string
): BrowserWindow {
  const display = screen.getPrimaryDisplay();
  const { x, y, width: dw, height: dh } = display.bounds;

  const overlay = new BrowserWindow({
    x,
    y,
    width: dw,
    height: dh,
    frame: false,
    transparent: false,
    skipTaskbar: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    movable: false,
    focusable: true,
    hasShadow: false,
    show: false,
    type: 'toolbar',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const imgBuffer = fs.readFileSync(screenshotPath);
  const base64Screenshot = imgBuffer.toString('base64');

  const overlayHTML = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body {
    overflow: hidden;
    cursor: crosshair;
    width: 100vw;
    height: 100vh;
    background: #000;
  }
  #bg {
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    z-index: 0;
    pointer-events: none;
  }
  #overlay {
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    background: rgba(0,0,0,0.3);
    z-index: 1;
    pointer-events: none;
  }
  #selection {
    position: fixed;
    border: 2px solid #00aaff;
    background: rgba(0,170,255,0.1);
    z-index: 3;
    display: none;
    pointer-events: none;
  }
  #cutout {
    position: fixed;
    z-index: 2;
    overflow: hidden;
    display: none;
    pointer-events: none;
  }
  #cutout img {
    position: absolute;
    width: 100vw;
    height: 100vh;
    pointer-events: none;
  }
  #info {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    color: white;
    font-family: 'Segoe UI', sans-serif;
    font-size: 14px;
    background: rgba(0,0,0,0.7);
    padding: 8px 16px;
    border-radius: 8px;
    z-index: 10;
    pointer-events: none;
    user-select: none;
  }
  #event-layer {
    position: fixed;
    top: 0; left: 0;
    width: 100vw; height: 100vh;
    z-index: 20;
    cursor: crosshair;
  }
</style>
</head>
<body>
  <img id="bg" src="data:image/png;base64,${base64Screenshot}" />
  <div id="overlay"></div>
  <div id="cutout"><img id="cutout-img" src="data:image/png;base64,${base64Screenshot}" /></div>
  <div id="selection"></div>
  <div id="info">Drag to select area | ESC to cancel</div>
  <div id="event-layer"></div>

<script>
  const selection = document.getElementById('selection');
  const cutout = document.getElementById('cutout');
  const cutoutImg = document.getElementById('cutout-img');
  const eventLayer = document.getElementById('event-layer');
  let startX, startY, isDrawing = false;

  eventLayer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    isDrawing = true;
    selection.style.display = 'block';
    cutout.style.display = 'block';
  });

  eventLayer.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    selection.style.left = x + 'px';
    selection.style.top = y + 'px';
    selection.style.width = w + 'px';
    selection.style.height = h + 'px';

    cutout.style.left = x + 'px';
    cutout.style.top = y + 'px';
    cutout.style.width = w + 'px';
    cutout.style.height = h + 'px';
    cutoutImg.style.left = -x + 'px';
    cutoutImg.style.top = -y + 'px';
  });

  eventLayer.addEventListener('mouseup', (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);

    if (w > 5 && h > 5) {
      window.electronAPI.regionSelected({ x, y, width: w, height: h })
        .catch(err => console.error('regionSelected failed:', err));
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.electronAPI.cancelCapture()
        .catch(err => console.error('cancelCapture failed:', err));
    }
  });
</script>
</body>
</html>`;

  const tempHtmlPath = path.join(path.dirname(screenshotPath), 'overlay.html');
  fs.writeFileSync(tempHtmlPath, overlayHTML, 'utf-8');
  overlay.loadFile(tempHtmlPath);

  overlay.webContents.once('did-finish-load', () => {
    // Force exact screen coverage - no fullscreen, no kiosk
    overlay.setAlwaysOnTop(true, 'screen-saver');
    overlay.setBounds({ x, y, width: dw, height: dh });
    overlay.show();
    overlay.focus();
  });

  return overlay;
}

export function createMultiRegionOverlay(
  screenshotPath: string,
  onComplete: (regions: Array<{ x: number; y: number; width: number; height: number }>) => void,
  onCancel: () => void,
): BrowserWindow {
  const display = screen.getPrimaryDisplay();
  const { x, y, width: dw, height: dh } = display.bounds;

  const overlay = new BrowserWindow({
    x, y, width: dw, height: dh,
    frame: false, transparent: false, skipTaskbar: true,
    resizable: false, minimizable: false, maximizable: false,
    movable: false, focusable: true, hasShadow: false,
    show: false, type: 'toolbar',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const imgBuffer = fs.readFileSync(screenshotPath);
  const base64Screenshot = imgBuffer.toString('base64');

  const html = `<!DOCTYPE html>
<html>
<head>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { overflow: hidden; cursor: crosshair; width: 100vw; height: 100vh; background: #000; }
  #bg { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 0; pointer-events: none; }
  #overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.4); z-index: 1; pointer-events: none; }
  .region-box { position: fixed; border: 2px solid #00ff88; background: rgba(0,255,136,0.15); z-index: 3; pointer-events: none; }
  .region-box .region-label { position: absolute; top: -22px; left: 0; background: #00ff88; color: #000; font-size: 11px; padding: 2px 8px; border-radius: 3px; font-weight: bold; }
  .region-box .region-remove { position: absolute; top: -22px; right: 0; background: #ff4444; color: #fff; font-size: 11px; padding: 2px 6px; border-radius: 3px; cursor: pointer; pointer-events: auto; border: none; font-weight: bold; }
  #selection { position: fixed; border: 2px dashed #00aaff; background: rgba(0,170,255,0.1); z-index: 4; display: none; pointer-events: none; }
  #cutout-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 2; pointer-events: none; overflow: hidden; }
  .cutout-region { position: absolute; overflow: hidden; }
  .cutout-region img { position: absolute; width: 100vw; height: 100vh; }
  #info { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); color: white; font-family: 'Segoe UI', sans-serif; font-size: 13px; background: rgba(0,0,0,0.8); padding: 10px 20px; border-radius: 10px; z-index: 10; pointer-events: none; user-select: none; text-align: center; line-height: 1.6; }
  #info kbd { background: rgba(255,255,255,0.2); padding: 1px 6px; border-radius: 3px; font-size: 12px; }
  #event-layer { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 20; cursor: crosshair; }
</style>
</head>
<body>
  <img id="bg" src="data:image/png;base64,${base64Screenshot}" />
  <div id="overlay"></div>
  <div id="cutout-container"></div>
  <div id="selection"></div>
  <div id="info">
    Drag to select focus areas (sharp regions) | <kbd>Enter</kbd> to confirm | <kbd>Z</kbd> undo last | <kbd>Esc</kbd> cancel<br/>
    <span id="region-count">0 regions selected</span>
  </div>
  <div id="event-layer"></div>

<script>
  const selection = document.getElementById('selection');
  const cutoutContainer = document.getElementById('cutout-container');
  const eventLayer = document.getElementById('event-layer');
  const regionCountEl = document.getElementById('region-count');
  const regions = [];
  const regionElements = [];
  let startX, startY, isDrawing = false;

  function updateRegionDisplay() {
    regionCountEl.textContent = regions.length + ' region' + (regions.length !== 1 ? 's' : '') + ' selected';
    // Rebuild cutout container
    cutoutContainer.innerHTML = '';
    document.querySelectorAll('.region-box').forEach(el => el.remove());
    regions.forEach((r, i) => {
      // Cutout (shows original image through the region)
      const cutout = document.createElement('div');
      cutout.className = 'cutout-region';
      cutout.style.left = r.x + 'px'; cutout.style.top = r.y + 'px';
      cutout.style.width = r.w + 'px'; cutout.style.height = r.h + 'px';
      const img = document.createElement('img');
      img.src = document.getElementById('bg').src;
      img.style.left = -r.x + 'px'; img.style.top = -r.y + 'px';
      cutout.appendChild(img);
      cutoutContainer.appendChild(cutout);
      // Region border box
      const box = document.createElement('div');
      box.className = 'region-box';
      box.style.left = r.x + 'px'; box.style.top = r.y + 'px';
      box.style.width = r.w + 'px'; box.style.height = r.h + 'px';
      const label = document.createElement('span');
      label.className = 'region-label';
      label.textContent = '#' + (i + 1);
      box.appendChild(label);
      const removeBtn = document.createElement('button');
      removeBtn.className = 'region-remove';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        regions.splice(i, 1);
        updateRegionDisplay();
      });
      box.appendChild(removeBtn);
      document.body.appendChild(box);
    });
  }

  eventLayer.addEventListener('mousedown', (e) => {
    e.preventDefault();
    startX = e.clientX; startY = e.clientY;
    isDrawing = true;
    selection.style.display = 'block';
  });

  eventLayer.addEventListener('mousemove', (e) => {
    if (!isDrawing) return;
    e.preventDefault();
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    selection.style.left = x + 'px'; selection.style.top = y + 'px';
    selection.style.width = w + 'px'; selection.style.height = h + 'px';
  });

  eventLayer.addEventListener('mouseup', (e) => {
    if (!isDrawing) return;
    isDrawing = false;
    selection.style.display = 'none';
    const x = Math.min(e.clientX, startX);
    const y = Math.min(e.clientY, startY);
    const w = Math.abs(e.clientX - startX);
    const h = Math.abs(e.clientY - startY);
    if (w > 10 && h > 10) {
      regions.push({ x, y, w, h });
      updateRegionDisplay();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      window.electronAPI.cancelCapture();
    } else if (e.key === 'Enter' && regions.length > 0) {
      const mapped = regions.map(r => ({ x: r.x, y: r.y, width: r.w, height: r.h }));
      window.electronAPI.regionSelected(mapped);
    } else if (e.key === 'z' || e.key === 'Z') {
      if (regions.length > 0) {
        regions.pop();
        updateRegionDisplay();
      }
    }
  });
</script>
</body>
</html>`;

  const tempHtmlPath = path.join(path.dirname(screenshotPath), 'multi-overlay.html');
  fs.writeFileSync(tempHtmlPath, html, 'utf-8');
  overlay.loadFile(tempHtmlPath);

  overlay.webContents.once('did-finish-load', () => {
    overlay.setAlwaysOnTop(true, 'screen-saver');
    overlay.setBounds({ x, y, width: dw, height: dh });
    overlay.show();
    overlay.focus();
  });

  return overlay;
}
