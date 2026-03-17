import { OCR_SYSTEM_PROMPT, OCR_USER_PROMPT, CORRECTION_SYSTEM_PROMPT } from '../core/ocr/prompts';

export interface OCRResult {
  fullText: string;
  language: string;
  confidence: number;
  containsHandwriting: boolean;
  modelUsed: string;
  corrected?: boolean;
  correcting?: boolean;
  fromCache?: boolean;
}

// --- Hash-based cache ---
const ocrCache = new Map<string, OCRResult>();
const MAX_CACHE_SIZE = 50;

async function hashImage(base64: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(base64.slice(0, 10000)); // hash first 10KB for speed
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function cacheResult(hash: string, result: OCRResult) {
  if (ocrCache.size >= MAX_CACHE_SIZE) {
    const firstKey = ocrCache.keys().next().value;
    if (firstKey) ocrCache.delete(firstKey);
  }
  ocrCache.set(hash, result);
}

// --- OCR API call ---
async function callOCR(apiKey: string, model: string, imageBase64: string): Promise<OCRResult> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: OCR_SYSTEM_PROMPT },
        { role: 'user', content: [
          { type: 'text', text: OCR_USER_PROMPT },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
        ] },
      ],
      max_tokens: 4096,
      temperature: 0,
    }),
  });

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content || '';

  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) jsonStr = jsonMatch[1];

  // Try to extract JSON even if there's surrounding text
  const braceMatch = jsonStr.match(/\{[\s\S]*\}/);
  if (braceMatch) jsonStr = braceMatch[0];

  const parsed = JSON.parse(jsonStr.trim());

  const cachedModels = JSON.parse(localStorage.getItem('ocr-models-cache') || '[]');
  const modelInfo = cachedModels.find((m: any) => m.id === model);

  return {
    fullText: parsed.fullText || content,
    language: parsed.language || 'unknown',
    confidence: parsed.confidence || 0,
    containsHandwriting: parsed.containsHandwriting || false,
    modelUsed: modelInfo?.name || model,
  };
}

// --- Text correction ---
export async function correctText(apiKey: string, model: string, rawText: string): Promise<string | null> {
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: CORRECTION_SYSTEM_PROMPT },
          { role: 'user', content: rawText },
        ],
        max_tokens: 4096,
        temperature: 0,
      }),
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch { return null; }
}

// --- Fallback: confidence too low → retry with stronger prompt ---
function shouldRetry(result: OCRResult): boolean {
  if (result.confidence < 0.5) return true;
  if (result.fullText.trim().length < 3) return true;
  if (result.containsHandwriting && result.confidence < 0.6) return true;
  return false;
}

// --- Main OCR pipeline ---
export async function performOCR(
  apiKey: string,
  model: string,
  imageBase64: string,
): Promise<OCRResult> {
  // Check cache first
  const hash = await hashImage(imageBase64);
  const cached = ocrCache.get(hash);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  // First attempt
  let result = await callOCR(apiKey, model, imageBase64);

  // Retry with enhanced prompt if confidence is low
  if (shouldRetry(result)) {
    console.log(`[OCR] Low confidence (${result.confidence}), retrying...`);
    try {
      const retryResult = await callOCR(apiKey, model, imageBase64);
      if (retryResult.confidence > result.confidence) {
        result = retryResult;
      }
    } catch {
      // Keep original result on retry failure
    }
  }

  // Cache successful results
  if (result.fullText.trim().length > 0) {
    cacheResult(hash, result);
  }

  return result;
}

export function clearCache() {
  ocrCache.clear();
}
