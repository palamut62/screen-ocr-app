import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { execSync } from 'child_process';

let lastScreenshotPath: string = '';

function getTempDir(): string {
  const dir = path.join(app.getPath('temp'), 'screen-ocr');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function captureScreen(): Promise<string> {
  const filePath = path.join(getTempDir(), 'screen.png');

  // Write PowerShell script to temp file to avoid escaping issues
  const psPath = path.join(getTempDir(), 'capture.ps1');
  const savePath = filePath.replace(/\\/g, '\\\\');
  const psContent = `
Add-Type -TypeDefinition 'using System; using System.Runtime.InteropServices; public class DPIHelper { [DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); }'
[DPIHelper]::SetProcessDPIAware() | Out-Null
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$bounds = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$bitmap = New-Object System.Drawing.Bitmap($bounds.Width, $bounds.Height)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.CopyFromScreen($bounds.Location, [System.Drawing.Point]::Empty, $bounds.Size)
$bitmap.Save('${savePath}', [System.Drawing.Imaging.ImageFormat]::Png)
$graphics.Dispose()
$bitmap.Dispose()
`;
  fs.writeFileSync(psPath, psContent, 'utf-8');

  execSync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${psPath}"`, {
    timeout: 10000,
    windowsHide: true,
  });

  lastScreenshotPath = filePath;

  // Log actual screenshot dimensions for debugging
  const metadata = await sharp(filePath).metadata();
  console.log(`Screenshot captured: ${metadata.width}x${metadata.height}`);

  return filePath;
}

export async function captureRegion(region: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Promise<Buffer> {
  if (!lastScreenshotPath || !fs.existsSync(lastScreenshotPath)) {
    throw new Error('No screenshot available. Call captureScreen first.');
  }

  const cropped = await sharp(lastScreenshotPath)
    .extract({
      left: region.x,
      top: region.y,
      width: region.width,
      height: region.height,
    })
    .png()
    .toBuffer();

  return cropped;
}

export async function optimizeForOCR(imageBuffer: Buffer): Promise<string> {
  // Resize to max 1600px (good enough for OCR, much smaller payload)
  // Convert to JPEG quality 85 — ~3-5x smaller than PNG
  const optimized = await sharp(imageBuffer)
    .resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .jpeg({ quality: 85 })
    .toBuffer();

  return optimized.toString('base64');
}

export async function preprocessImage(imageBuffer: Buffer): Promise<Buffer> {
  const processed = await sharp(imageBuffer)
    .grayscale()
    .normalize()
    .sharpen({ sigma: 1.5 })
    .resize({
      width: 2048,
      height: 2048,
      fit: 'inside',
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();

  return processed;
}
