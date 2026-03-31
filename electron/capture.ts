import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { app, desktopCapturer, screen } from 'electron';

let lastScreenshotPath: string = '';

function getTempDir(): string {
  const dir = path.join(app.getPath('temp'), 'screen-ocr');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export async function captureScreen(): Promise<string> {
  const filePath = path.join(getTempDir(), 'screen.png');

  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.size;
  const scaleFactor = primaryDisplay.scaleFactor;

  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: Math.round(width * scaleFactor),
      height: Math.round(height * scaleFactor),
    },
  });

  if (!sources.length) {
    throw new Error('No screen source found for capture');
  }

  const imgBuffer = sources[0].thumbnail.toPNG();
  fs.writeFileSync(filePath, imgBuffer);

  lastScreenshotPath = filePath;

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

export async function createBlurredCapture(region: {
  x: number;
  y: number;
  width: number;
  height: number;
}): Promise<Buffer> {
  return createMultiRegionBlur([region]);
}

export async function createMultiRegionBlur(
  regions: Array<{ x: number; y: number; width: number; height: number }>,
  sourcePath?: string,
): Promise<Buffer> {
  const src = sourcePath || lastScreenshotPath;
  if (!src || !fs.existsSync(src)) {
    throw new Error('No image source available.');
  }

  const metadata = await sharp(src).metadata();
  const imgW = metadata.width!;
  const imgH = metadata.height!;

  const blurred = await sharp(src).blur(20).png().toBuffer();

  const composites: Array<{ input: Buffer; left: number; top: number }> = [];
  for (const region of regions) {
    const left = Math.max(0, Math.min(region.x, imgW - 1));
    const top = Math.max(0, Math.min(region.y, imgH - 1));
    const width = Math.min(region.width, imgW - left);
    const height = Math.min(region.height, imgH - top);
    if (width < 1 || height < 1) continue;

    const sharpRegion = await sharp(src)
      .extract({ left, top, width, height })
      .png()
      .toBuffer();

    composites.push({ input: sharpRegion, left, top });
  }

  const result = await sharp(blurred).composite(composites).png().toBuffer();
  return result;
}

export async function optimizeForOCR(imageBuffer: Buffer): Promise<string> {
  const metadata = await sharp(imageBuffer).metadata();
  const w = metadata.width || 0;
  const h = metadata.height || 0;

  let pipeline = sharp(imageBuffer);

  // Step 1: Grayscale — removes color noise, reduces payload
  pipeline = pipeline.grayscale();

  // Step 2: Normalize contrast — makes faint text more readable
  pipeline = pipeline.normalize();

  // Step 3: Sharpen — improves edge clarity for text
  pipeline = pipeline.sharpen({ sigma: 1.2 });

  // Step 4: Upscale small images so text isn't too tiny for the model
  // If the image is very small (< 800px on either side), upscale to 1600px
  if (w < 800 || h < 800) {
    pipeline = pipeline.resize({
      width: 1600,
      height: 1600,
      fit: 'inside',
      withoutEnlargement: false,
    });
  } else {
    // Step 5: Downscale large images to save tokens
    pipeline = pipeline.resize({
      width: 2048,
      height: 2048,
      fit: 'inside',
      withoutEnlargement: true,
    });
  }

  // Step 6: Output as high-quality JPEG (good balance of size vs quality)
  const optimized = await pipeline.jpeg({ quality: 90 }).toBuffer();

  console.log(`[OCR Preprocess] ${w}x${h} → ${optimized.length} bytes`);
  return optimized.toString('base64');
}
