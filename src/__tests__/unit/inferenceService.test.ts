/**
 * inferenceService unit tests.
 *
 * The llama.rn jest mock is registered globally in `jest.setup.ts`
 * (via `llama.rn/jest/mock`). It fires a handful of stub tokens to the
 * onToken callback and returns a fixed completion result of `*giggles*`,
 * which lets us assert plumbing without a real model.
 */
import { ANTOINE_SYSTEM_PROMPT } from '@/constants/antoine';
import {
  __forceError,
  buildMessageArray,
  completion,
  initLlama,
  releaseAllLlama,
} from '@/services/inferenceService';

describe('inferenceService', () => {
  beforeEach(() => {
    __forceError.value = false;
  });

  it('initLlama loads the native context and returns it wrapped with the model path', async () => {
    const ctx = await initLlama({ model: '/data/user/0/app/files/models/antoine/v1/model.gguf' });
    expect(ctx.modelPath).toBe('/data/user/0/app/files/models/antoine/v1/model.gguf');
    expect(typeof ctx.id).toBe('number');
    expect(ctx.native).toBeDefined();
  });

  it('initLlama throws when __forceError is on', async () => {
    __forceError.value = true;
    await expect(initLlama({ model: 'm' })).rejects.toThrow(/Couldn’t load Antoine/);
  });

  it('completion returns the mocked text from the native context', async () => {
    const ctx = await initLlama({ model: 'm' });
    const result = await completion(ctx, {
      messages: buildMessageArray([{ role: 'user', content: 'hi' }]),
    });
    expect(result.text).toBe('*giggles*');
    expect(result.tokensUsed).toBeGreaterThan(0);
  });

  it('completion fires the streaming callback per token', async () => {
    const ctx = await initLlama({ model: 'm' });
    const tokens: string[] = [];
    await completion(ctx, { messages: buildMessageArray([{ role: 'user', content: 'hi' }]) }, (t) =>
      tokens.push(t),
    );
    expect(tokens.length).toBeGreaterThan(0);
    // Mock streams ` *`, `g`, `igg`, `les`, `*` — concatenation gives ` *giggles*`.
    expect(tokens.join('').trim()).toBe('*giggles*');
  });

  it('completion forwards the messages array to the native context', async () => {
    const ctx = await initLlama({ model: 'm' });
    const spy = jest.spyOn(ctx.native, 'completion');
    await completion(ctx, {
      messages: buildMessageArray([{ role: 'user', content: 'hi' }]),
    });
    const callArgs = spy.mock.calls[0]?.[0] as { messages?: unknown[] };
    expect(callArgs?.messages?.[0]).toEqual({ role: 'system', content: ANTOINE_SYSTEM_PROMPT });
    expect(callArgs?.messages?.[1]).toEqual({ role: 'user', content: 'hi' });
    spy.mockRestore();
  });

  it('completion throws when __forceError is on', async () => {
    const ctx = await initLlama({ model: 'm' });
    __forceError.value = true;
    await expect(completion(ctx, { messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow(
      /Antoine stalled/,
    );
  });

  it('releaseAllLlama resolves cleanly', async () => {
    await expect(releaseAllLlama()).resolves.toBeUndefined();
  });

  it('buildMessageArray prepends the Antoine system prompt', () => {
    const out = buildMessageArray([{ role: 'user', content: 'hi' }]);
    expect(out[0]?.role).toBe('system');
    expect(out[0]?.content).toBe(ANTOINE_SYSTEM_PROMPT);
    expect(out[1]?.content).toBe('hi');
  });
});
