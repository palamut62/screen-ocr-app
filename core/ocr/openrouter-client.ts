import axios from 'axios';
import { OCR_SYSTEM_PROMPT, OCR_USER_PROMPT } from './prompts';
import { getModelQueue, shouldFallback, type OCRModel } from './model-router';

export interface OCRResult {
  fullText: string;
  language: string;
  confidence: number;
  containsHandwriting: boolean;
  modelUsed: string;
}

async function callModel(
  apiKey: string,
  model: OCRModel,
  imageBase64: string
): Promise<OCRResult | null> {
  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: model.id,
        messages: [
          { role: 'system', content: OCR_SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              { type: 'text', text: OCR_USER_PROMPT },
              {
                type: 'image_url',
                image_url: { url: `data:image/png;base64,${imageBase64}` },
              },
            ],
          },
        ],
        max_tokens: 4096,
        temperature: 0,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const content = response.data.choices?.[0]?.message?.content || '';

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content;
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1];
    }

    const parsed = JSON.parse(jsonStr.trim());

    return {
      fullText: parsed.fullText || '',
      language: parsed.language || 'unknown',
      confidence: parsed.confidence || 0,
      containsHandwriting: parsed.containsHandwriting || false,
      modelUsed: model.name,
    };
  } catch (err) {
    console.error(`OCR failed with model ${model.name}:`, err);
    return null;
  }
}

export async function performOCR(
  apiKey: string,
  imageBase64: string,
  freeFirst: boolean = true
): Promise<OCRResult> {
  const queue = getModelQueue(freeFirst);

  for (const model of queue) {
    const result = await callModel(apiKey, model, imageBase64);

    if (result && !shouldFallback(result)) {
      return result;
    }

    // If it's the last model, return whatever we got
    if (model === queue[queue.length - 1] && result) {
      return result;
    }
  }

  return {
    fullText: '',
    language: 'unknown',
    confidence: 0,
    containsHandwriting: false,
    modelUsed: 'none',
  };
}
