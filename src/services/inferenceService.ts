/**
 * On-device inference service.
 *
 * v1: stub. Returns canned responses keyed off the last user message so the
 * chat UI can be exercised end-to-end without `llama.rn` installed. The
 * exported function shapes match `llama.rn` so swap-in is one line per
 * function (replace the stub with the real `import { initLlama, ... } from
 * 'llama.rn'`).
 *
 * NEVER make network calls from this file. Per CLAUDE.md privacy rule,
 * conversation content stays on device.
 */
import { ANTOINE_SYSTEM_PROMPT } from '@/constants/antoine';
import type { InferenceMessage, InferenceResult } from '@/types/inference';

export interface LlamaContext {
  id: number;
  modelPath: string;
}

export interface InitOptions {
  model: string;
  mmproj?: string;
  contextSize?: number;
  threadCount?: number;
}

export interface CompletionParams {
  messages: InferenceMessage[];
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

let nextContextId = 1;

/**
 * Test-only switch. Set `__forceError.value = true` to make completion()
 * throw, exercising the chat error path.
 */
export const __forceError = { value: false };

const CANNED: readonly (readonly [RegExp, string])[] = [
  [
    /hollandaise/i,
    'Hollandaise broke — likely temperature. Off heat. Whisk in 2 oz warm clarified butter, drop by drop until it pulls back together. If the bowl feels hot to the touch, let it sit 30 seconds first.',
  ],
  [
    /steak|sear|temp/i,
    'For a 1.5-inch ribeye: 500°F cast iron, 90 seconds per side, then 2 minutes basting in butter, thyme, garlic. Pull at 125°F internal. Rest 8 minutes. Finished temp lands at 130°F.',
  ],
  [
    /dough|knead|rise/i,
    'If the dough won’t rise, it’s usually one of three: yeast is dead, room is below 70°F, or salt killed the yeast at first contact. Test the yeast in warm water + a pinch of sugar — should foam in 5 minutes.',
  ],
  [
    /substitute|replace|out of/i,
    'Tell me the recipe and what you’re short on. I’ll give you a substitution that won’t shift the dish.',
  ],
];

export async function initLlama(options: InitOptions): Promise<LlamaContext> {
  await sleep(300);
  if (__forceError.value)
    throw new Error('Couldn’t load Antoine. Check the model files in Settings.');
  return { id: nextContextId++, modelPath: options.model };
}

export async function completion(
  _ctx: LlamaContext,
  params: CompletionParams,
): Promise<InferenceResult> {
  await sleep(500);
  if (__forceError.value) {
    throw new Error('Antoine stalled. Try the question again.');
  }

  const lastUser = [...params.messages].reverse().find((m) => m.role === 'user');
  if (!lastUser) {
    return { text: 'Tell me what you’re working on.' };
  }
  for (const [pattern, reply] of CANNED) {
    if (pattern.test(lastUser.content)) return { text: reply };
  }
  return {
    text: `I’m not actually loaded yet — this is a development stub. When the real model is downloaded I’ll answer "${lastUser.content}" with technique, temperature, and timing.`,
  };
}

export async function releaseAllLlama(): Promise<void> {
  await sleep(50);
}

export function buildMessageArray(history: InferenceMessage[]): InferenceMessage[] {
  return [{ role: 'system', content: ANTOINE_SYSTEM_PROMPT }, ...history];
}
