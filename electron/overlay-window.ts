import { BrowserWindow, screen } from 'electron';
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
