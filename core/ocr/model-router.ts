export interface OCRModel {
  id: string;
  name: string;
  priority: number;
  isFree: boolean;
}

export const MODELS: OCRModel[] = [
  { id: 'nvidia/nemotron-nano-12b-v2-vl:free', name: 'Nemotron Nano (Free)', priority: 1, isFree: true },
  { id: 'qwen/qwen3-vl-8b-instruct', name: 'Qwen3 VL 8B', priority: 2, isFree: false },
  { id: 'qwen/qwen2.5-vl-32b-instruct', name: 'Qwen2.5 VL 32B', priority: 3, isFree: false },
];

export function getModelQueue(freeFirst: boolean): OCRModel[] {
  if (freeFirst) {
    return [...MODELS].sort((a, b) => {
      if (a.isFree && !b.isFree) return -1;
      if (!a.isFree && b.isFree) return 1;
      return a.priority - b.priority;
    });
  }
  return [...MODELS].sort((a, b) => a.priority - b.priority);
}

export function shouldFallback(result: { fullText: string; confidence: number; containsHandwriting: boolean }): boolean {
  if (result.confidence < 0.5) return true;
  if (result.fullText.trim().length < 3) return true;
  if (result.containsHandwriting && result.confidence < 0.7) return true;
  return false;
}
