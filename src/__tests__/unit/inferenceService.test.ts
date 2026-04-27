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

  it('initLlama returns a context with the model path', async () => {
    const ctx = await initLlama({ model: 'antoine.gguf' });
    expect(ctx.modelPath).toBe('antoine.gguf');
    expect(typeof ctx.id).toBe('number');
  });

  it('completion returns the canned hollandaise reply', async () => {
    const ctx = await initLlama({ model: 'm' });
    const r = await completion(ctx, {
      messages: [{ role: 'user', content: 'My hollandaise broke' }],
    });
    expect(r.text).toMatch(/hollandaise/i);
  });

  it('completion returns a default fallback for unknown questions', async () => {
    const ctx = await initLlama({ model: 'm' });
    const r = await completion(ctx, {
      messages: [{ role: 'user', content: 'random question that matches nothing' }],
    });
    expect(r.text).toMatch(/development stub/i);
  });

  it('completion throws when __forceError is on', async () => {
    const ctx = await initLlama({ model: 'm' });
    __forceError.value = true;
    await expect(completion(ctx, { messages: [{ role: 'user', content: 'x' }] })).rejects.toThrow();
  });

  it('releaseAllLlama resolves cleanly', async () => {
    await expect(releaseAllLlama()).resolves.toBeUndefined();
  });

  it('buildMessageArray prepends the Antoine system prompt', () => {
    const out = buildMessageArray([{ role: 'user', content: 'hi' }]);
    expect(out[0]?.role).toBe('system');
    expect(out[1]?.content).toBe('hi');
  });
});
