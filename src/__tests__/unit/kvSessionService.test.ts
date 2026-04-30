/**
 * kvSessionService unit tests.
 *
 * Mocks expo-file-system, expo-crypto, and modelLocator. A fake
 * LlamaContext provides stub native.tokenize/saveSession/loadSession
 * methods so we can drive the success and failure paths without a real
 * model.
 *
 * The five invalidation triggers are each exercised:
 *   1. No sidecar (clean first launch) → returns false
 *   2. Hash mismatch → delete + return false
 *   3. llama.rn version mismatch → delete + return false
 *   4. Runtime fingerprint mismatch → delete + return false
 *   5. Corrupt sidecar JSON → delete + return false
 *   6. Native loadSession throws → delete + return false
 *   7. tokens_loaded mismatch → delete + return false
 *
 * Plus: save round-trip, save on disk-full no-op, deleteSavedKV.
 */
/* eslint-disable import/first */
jest.mock('expo-file-system/legacy', () => ({
  // Defaults return promises so callers using `.catch()` on the result
  // don't blow up. Individual tests override via mockResolvedValue.
  getInfoAsync: jest.fn(async () => ({ exists: false })),
  readAsStringAsync: jest.fn(async () => ''),
  writeAsStringAsync: jest.fn(async () => undefined),
  makeDirectoryAsync: jest.fn(async () => undefined),
  readDirectoryAsync: jest.fn(async () => [] as string[]),
  deleteAsync: jest.fn(async () => undefined),
}));

jest.mock('expo-crypto', () => ({
  digestStringAsync: jest.fn(),
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
}));

jest.mock('@/services/modelLocator', () => ({
  getDocumentDirectoryBase: jest.fn(async () => '/data/user/0/app/files'),
  joinPath: (...parts: string[]): string =>
    parts
      .map((p, i) => (i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+|\/+$/g, '')))
      .filter((p) => p.length > 0)
      .join('/'),
  toFileUri: (path: string): string => (path.startsWith('file://') ? path : `file://${path}`),
}));

import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import { INFERENCE_RUNTIME, LLAMA_RN_VERSION } from '@/services/inferenceService';
import {
  __resetKvSessionFlagForTests,
  deleteSavedKV,
  loadSystemPromptKV,
  markKvHandled,
  saveSystemPromptKV,
  wasKvHandledThisSession,
} from '@/services/kvSessionService';
import type { LlamaContext } from '@/services/inferenceService';
/* eslint-enable import/first */

const fsMock = FileSystem as jest.Mocked<typeof FileSystem>;
const cryptoMock = Crypto as jest.Mocked<typeof Crypto>;

const FAKE_PROMPT = 'You are Antoine, a culinary AI assistant.';
const FAKE_HASH_FULL = 'a'.repeat(64); // 64-char hex (sha256 hex length)
const FAKE_HASH_PREFIX = FAKE_HASH_FULL.slice(0, 12);
const KV_DIR = '/data/user/0/app/files/kv-state';
const BIN_PATH = `${KV_DIR}/system-prompt-${FAKE_HASH_PREFIX}.bin`;
const SIDECAR_PATH = `${KV_DIR}/system-prompt-${FAKE_HASH_PREFIX}.json`;
const BIN_URI = `file://${BIN_PATH}`;
const SIDECAR_URI = `file://${SIDECAR_PATH}`;
const KV_DIR_URI = `file://${KV_DIR}`;

function makeFakeContext(): LlamaContext {
  return {
    id: 1,
    modelPath: '/mock/model.gguf',
    native: {
      tokenize: jest.fn(async () => ({
        tokens: new Array(410).fill(0),
        has_media: false,
        bitmap_hashes: [],
        chunk_pos: [],
        chunk_pos_media: [],
      })),
      saveSession: jest.fn(async () => 410),
      loadSession: jest.fn(async () => ({ tokens_loaded: 410, prompt: FAKE_PROMPT })),
    } as unknown as LlamaContext['native'],
  };
}

function makeValidSidecar(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    promptHashFull: FAKE_HASH_FULL,
    promptByteLength: FAKE_PROMPT.length,
    tokenSize: 410,
    llamaRnVersion: LLAMA_RN_VERSION,
    runtime: {
      n_ctx: INFERENCE_RUNTIME.n_ctx,
      n_batch: INFERENCE_RUNTIME.n_batch,
      cache_type_k: INFERENCE_RUNTIME.cache_type_k,
      cache_type_v: INFERENCE_RUNTIME.cache_type_v,
    },
    savedAt: 1000000,
    ...overrides,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  __resetKvSessionFlagForTests();
  cryptoMock.digestStringAsync.mockResolvedValue(FAKE_HASH_FULL);
});

describe('loadSystemPromptKV', () => {
  it('returns false when no sidecar exists (clean first launch)', async () => {
    fsMock.getInfoAsync.mockResolvedValue({
      exists: false,
      uri: SIDECAR_URI,
      isDirectory: false,
    } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>);
    const ctx = makeFakeContext();

    const result = await loadSystemPromptKV(ctx, FAKE_PROMPT);

    expect(result).toBe(false);
    expect(ctx.native.loadSession).not.toHaveBeenCalled();
  });

  it('returns true on a valid round-trip', async () => {
    fsMock.getInfoAsync.mockResolvedValue({
      exists: true,
      uri: SIDECAR_URI,
      isDirectory: false,
    } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>);
    fsMock.readAsStringAsync.mockResolvedValue(makeValidSidecar());
    const ctx = makeFakeContext();

    const result = await loadSystemPromptKV(ctx, FAKE_PROMPT);

    expect(result).toBe(true);
    expect(ctx.native.loadSession).toHaveBeenCalledWith(BIN_PATH);
    expect(fsMock.deleteAsync).not.toHaveBeenCalled();
  });

  it('deletes and returns false on hash mismatch', async () => {
    fsMock.getInfoAsync.mockResolvedValue({
      exists: true,
      uri: SIDECAR_URI,
      isDirectory: false,
    } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>);
    fsMock.readAsStringAsync.mockResolvedValue(
      makeValidSidecar({ promptHashFull: 'b'.repeat(64) }),
    );
    const ctx = makeFakeContext();

    const result = await loadSystemPromptKV(ctx, FAKE_PROMPT);

    expect(result).toBe(false);
    expect(ctx.native.loadSession).not.toHaveBeenCalled();
    expect(fsMock.deleteAsync).toHaveBeenCalledWith(BIN_URI, { idempotent: true });
    expect(fsMock.deleteAsync).toHaveBeenCalledWith(SIDECAR_URI, { idempotent: true });
  });

  it('deletes and returns false on llama.rn version mismatch', async () => {
    fsMock.getInfoAsync.mockResolvedValue({
      exists: true,
      uri: SIDECAR_URI,
      isDirectory: false,
    } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>);
    fsMock.readAsStringAsync.mockResolvedValue(makeValidSidecar({ llamaRnVersion: '0.0.1-fake' }));
    const ctx = makeFakeContext();

    const result = await loadSystemPromptKV(ctx, FAKE_PROMPT);

    expect(result).toBe(false);
    expect(ctx.native.loadSession).not.toHaveBeenCalled();
    expect(fsMock.deleteAsync).toHaveBeenCalledTimes(2);
  });

  it('deletes and returns false on runtime fingerprint mismatch (n_ctx changed)', async () => {
    fsMock.getInfoAsync.mockResolvedValue({
      exists: true,
      uri: SIDECAR_URI,
      isDirectory: false,
    } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>);
    fsMock.readAsStringAsync.mockResolvedValue(
      makeValidSidecar({
        runtime: {
          n_ctx: 1024, // different from INFERENCE_RUNTIME.n_ctx (2048)
          n_batch: INFERENCE_RUNTIME.n_batch,
          cache_type_k: INFERENCE_RUNTIME.cache_type_k,
          cache_type_v: INFERENCE_RUNTIME.cache_type_v,
        },
      }),
    );
    const ctx = makeFakeContext();

    const result = await loadSystemPromptKV(ctx, FAKE_PROMPT);

    expect(result).toBe(false);
    expect(ctx.native.loadSession).not.toHaveBeenCalled();
    expect(fsMock.deleteAsync).toHaveBeenCalledTimes(2);
  });

  it('returns false on corrupt sidecar JSON', async () => {
    fsMock.getInfoAsync.mockResolvedValue({
      exists: true,
      uri: SIDECAR_URI,
      isDirectory: false,
    } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>);
    fsMock.readAsStringAsync.mockResolvedValue('not valid json {{{');
    const ctx = makeFakeContext();

    const result = await loadSystemPromptKV(ctx, FAKE_PROMPT);

    expect(result).toBe(false);
    expect(ctx.native.loadSession).not.toHaveBeenCalled();
  });

  it('deletes and returns false when native loadSession throws', async () => {
    fsMock.getInfoAsync.mockResolvedValue({
      exists: true,
      uri: SIDECAR_URI,
      isDirectory: false,
    } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>);
    fsMock.readAsStringAsync.mockResolvedValue(makeValidSidecar());
    const ctx = makeFakeContext();
    (ctx.native.loadSession as jest.Mock).mockRejectedValueOnce(new Error('corrupt KV file'));

    const result = await loadSystemPromptKV(ctx, FAKE_PROMPT);

    expect(result).toBe(false);
    expect(fsMock.deleteAsync).toHaveBeenCalled();
  });

  it('deletes and returns false when tokens_loaded != saved tokenSize', async () => {
    fsMock.getInfoAsync.mockResolvedValue({
      exists: true,
      uri: SIDECAR_URI,
      isDirectory: false,
    } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>);
    fsMock.readAsStringAsync.mockResolvedValue(makeValidSidecar({ tokenSize: 410 }));
    const ctx = makeFakeContext();
    (ctx.native.loadSession as jest.Mock).mockResolvedValueOnce({
      tokens_loaded: 200, // partial restore
      prompt: FAKE_PROMPT,
    });

    const result = await loadSystemPromptKV(ctx, FAKE_PROMPT);

    expect(result).toBe(false);
    expect(fsMock.deleteAsync).toHaveBeenCalledTimes(2);
  });
});

describe('saveSystemPromptKV', () => {
  it('writes the .bin via native.saveSession AND a sidecar JSON next to it', async () => {
    fsMock.getInfoAsync.mockResolvedValue({
      exists: true,
      uri: KV_DIR_URI,
      isDirectory: true,
    } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>);
    const ctx = makeFakeContext();

    await saveSystemPromptKV(ctx, FAKE_PROMPT);

    expect(ctx.native.tokenize).toHaveBeenCalledWith(FAKE_PROMPT);
    expect(ctx.native.saveSession).toHaveBeenCalledWith(BIN_PATH, { tokenSize: 410 });
    expect(fsMock.writeAsStringAsync).toHaveBeenCalledTimes(1);
    const [writePath, writeBody] = fsMock.writeAsStringAsync.mock.calls[0] ?? [];
    expect(writePath).toBe(SIDECAR_URI);
    const sidecar = JSON.parse(writeBody as string) as Record<string, unknown>;
    expect(sidecar.promptHashFull).toBe(FAKE_HASH_FULL);
    expect(sidecar.tokenSize).toBe(410);
    expect(sidecar.llamaRnVersion).toBe(LLAMA_RN_VERSION);
    expect((sidecar.runtime as { n_ctx: number }).n_ctx).toBe(INFERENCE_RUNTIME.n_ctx);
  });

  it('creates the kv-state directory if missing', async () => {
    fsMock.getInfoAsync.mockResolvedValue({
      exists: false,
      uri: KV_DIR_URI,
      isDirectory: false,
    } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>);
    const ctx = makeFakeContext();

    await saveSystemPromptKV(ctx, FAKE_PROMPT);

    expect(fsMock.makeDirectoryAsync).toHaveBeenCalledWith(KV_DIR_URI, { intermediates: true });
  });

  it('swallows native.saveSession errors without throwing (best-effort)', async () => {
    fsMock.getInfoAsync.mockResolvedValue({
      exists: true,
      uri: KV_DIR_URI,
      isDirectory: true,
    } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>);
    const ctx = makeFakeContext();
    (ctx.native.saveSession as jest.Mock).mockRejectedValueOnce(new Error('ENOSPC: disk full'));

    await expect(saveSystemPromptKV(ctx, FAKE_PROMPT)).resolves.toBeUndefined();
    expect(fsMock.writeAsStringAsync).not.toHaveBeenCalled();
  });

  it('skips save when tokenize returns zero tokens', async () => {
    fsMock.getInfoAsync.mockResolvedValue({
      exists: true,
      uri: KV_DIR_URI,
      isDirectory: true,
    } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>);
    const ctx = makeFakeContext();
    (ctx.native.tokenize as jest.Mock).mockResolvedValueOnce({
      tokens: [],
      has_media: false,
      bitmap_hashes: [],
      chunk_pos: [],
      chunk_pos_media: [],
    });

    await saveSystemPromptKV(ctx, FAKE_PROMPT);

    expect(ctx.native.saveSession).not.toHaveBeenCalled();
    expect(fsMock.writeAsStringAsync).not.toHaveBeenCalled();
  });
});

describe('deleteSavedKV', () => {
  it('removes every system-prompt-* file under kv-state/', async () => {
    fsMock.getInfoAsync.mockResolvedValue({
      exists: true,
      uri: KV_DIR_URI,
      isDirectory: true,
    } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>);
    fsMock.readDirectoryAsync.mockResolvedValue([
      'system-prompt-aaa.bin',
      'system-prompt-aaa.json',
      'unrelated.txt',
    ]);

    await deleteSavedKV();

    expect(fsMock.deleteAsync).toHaveBeenCalledWith(`file://${KV_DIR}/system-prompt-aaa.bin`, {
      idempotent: true,
    });
    expect(fsMock.deleteAsync).toHaveBeenCalledWith(`file://${KV_DIR}/system-prompt-aaa.json`, {
      idempotent: true,
    });
    expect(fsMock.deleteAsync).not.toHaveBeenCalledWith(
      `file://${KV_DIR}/unrelated.txt`,
      expect.anything(),
    );
  });

  it('no-ops when the kv-state directory is missing', async () => {
    fsMock.getInfoAsync.mockResolvedValue({
      exists: false,
      uri: KV_DIR_URI,
      isDirectory: false,
    } as Awaited<ReturnType<typeof FileSystem.getInfoAsync>>);

    await deleteSavedKV();

    expect(fsMock.deleteAsync).not.toHaveBeenCalled();
    expect(fsMock.readDirectoryAsync).not.toHaveBeenCalled();
  });
});

describe('session flag', () => {
  it('starts false; markKvHandled flips it true; reset clears', () => {
    expect(wasKvHandledThisSession()).toBe(false);
    markKvHandled();
    expect(wasKvHandledThisSession()).toBe(true);
    __resetKvSessionFlagForTests();
    expect(wasKvHandledThisSession()).toBe(false);
  });
});
