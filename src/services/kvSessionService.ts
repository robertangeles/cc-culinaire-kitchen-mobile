/**
 * kvSessionService — persist the system-prompt slice of llama.cpp's KV
 * cache across app launches.
 *
 * Why: cold-launch turn 1 prefills the ~410-token system prompt every
 * time, costing ~45s on the Moto G86 Power. By saving the system prompt's
 * KV state after the first successful completion of a JS lifetime and
 * restoring it via `loadSession()` on the next launch, turn 1 of every
 * subsequent launch drops from ~78s to ~37s. Only the RAG block + user
 * message pay full prefill.
 *
 * The dangerous bit: wrong invalidation = model attends to KV from a
 * different prompt = silent garbage output. This module invalidates
 * aggressively. Five independent triggers:
 *
 *   1. Prompt hash mismatch (server prompt edited)
 *   2. llama.rn version changed (binary KV format may differ)
 *   3. Runtime fingerprint changed (n_ctx / cache_type_k / cache_type_v / n_batch)
 *   4. Native loadSession threw (corrupt file, partial write)
 *   5. tokens_loaded != saved tokenSize (the sidecar lied)
 *
 * Privacy: state files live in app-private storage, never sync, never
 * upload. KV state is derived from the on-device system prompt body
 * only. See wiki/concepts/privacy-invariant.md.
 */
import * as Crypto from 'expo-crypto';
import * as FileSystem from 'expo-file-system/legacy';

import {
  INFERENCE_RUNTIME,
  LLAMA_RN_VERSION,
  type LlamaContext,
} from '@/services/inferenceService';
import { getDocumentDirectoryBase, joinPath, toFileUri } from '@/services/modelLocator';

interface KvSidecar {
  promptHashFull: string;
  promptByteLength: number;
  tokenSize: number;
  llamaRnVersion: string;
  runtime: {
    n_ctx: number;
    n_batch: number;
    cache_type_k: string;
    cache_type_v: string;
  };
  savedAt: number;
}

const KV_STATE_DIR = 'kv-state';
const HASH_PREFIX_LEN = 12;
const SIDECAR_PREFIX = 'system-prompt-';

let kvHandledThisSession = false;

/**
 * True once either `loadSystemPromptKV` returned true OR `markKvHandled`
 * was called from `useAntoine.send()` after the first save fired. The
 * chat hot path uses this to avoid firing `saveSystemPromptKV` on every
 * single send — once per JS lifetime is enough.
 */
export function wasKvHandledThisSession(): boolean {
  return kvHandledThisSession;
}

export function markKvHandled(): void {
  kvHandledThisSession = true;
}

/** Test-only reset. Production code never calls this. */
export function __resetKvSessionFlagForTests(): void {
  kvHandledThisSession = false;
}

async function hashSystemPrompt(body: string): Promise<{ full: string; prefix: string }> {
  const full = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, body);
  return { full, prefix: full.slice(0, HASH_PREFIX_LEN) };
}

async function getKvStateDir(): Promise<string> {
  const base = await getDocumentDirectoryBase();
  return joinPath(base, KV_STATE_DIR);
}

async function ensureKvStateDir(): Promise<string> {
  const dir = await getKvStateDir();
  const info = await FileSystem.getInfoAsync(toFileUri(dir));
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(toFileUri(dir), { intermediates: true });
  }
  return dir;
}

function pathsForPrefix(dir: string, prefix: string): { bin: string; sidecar: string } {
  return {
    bin: joinPath(dir, `${SIDECAR_PREFIX}${prefix}.bin`),
    sidecar: joinPath(dir, `${SIDECAR_PREFIX}${prefix}.json`),
  };
}

async function readSidecar(sidecarPath: string): Promise<KvSidecar | null> {
  try {
    const info = await FileSystem.getInfoAsync(toFileUri(sidecarPath));
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(toFileUri(sidecarPath));
    const parsed = JSON.parse(raw) as Partial<KvSidecar>;
    if (
      typeof parsed.promptHashFull === 'string' &&
      typeof parsed.tokenSize === 'number' &&
      typeof parsed.llamaRnVersion === 'string' &&
      parsed.runtime != null &&
      typeof parsed.runtime.n_ctx === 'number' &&
      typeof parsed.runtime.n_batch === 'number' &&
      typeof parsed.runtime.cache_type_k === 'string' &&
      typeof parsed.runtime.cache_type_v === 'string'
    ) {
      return parsed as KvSidecar;
    }
    return null;
  } catch {
    return null;
  }
}

function runtimeFingerprintMatches(saved: KvSidecar['runtime']): boolean {
  return (
    saved.n_ctx === INFERENCE_RUNTIME.n_ctx &&
    saved.n_batch === INFERENCE_RUNTIME.n_batch &&
    saved.cache_type_k === INFERENCE_RUNTIME.cache_type_k &&
    saved.cache_type_v === INFERENCE_RUNTIME.cache_type_v
  );
}

async function deleteKvFiles(bin: string, sidecar: string): Promise<void> {
  await Promise.all([
    FileSystem.deleteAsync(toFileUri(bin), { idempotent: true }).catch(() => undefined),
    FileSystem.deleteAsync(toFileUri(sidecar), { idempotent: true }).catch(() => undefined),
  ]);
}

/**
 * Best-effort cleanup of saved KV files left behind by prior prompt
 * versions. Without this, every system-prompt edit would leak ~10–13 MB
 * to disk forever (the file path is keyed by prompt hash prefix, so an
 * edited prompt writes to a fresh path and leaves the old one alone).
 *
 * Called from `saveSystemPromptKV` AFTER the new file is fully on disk,
 * so a cleanup failure can never lose the live state. Failures are
 * swallowed — the orphan stays harmlessly until the next save.
 */
async function pruneOrphanKvFiles(currentPrefix: string): Promise<void> {
  try {
    const dir = await getKvStateDir();
    const info = await FileSystem.getInfoAsync(toFileUri(dir));
    if (!info.exists) return;
    const entries = await FileSystem.readDirectoryAsync(toFileUri(dir));
    const keepBin = `${SIDECAR_PREFIX}${currentPrefix}.bin`;
    const keepSidecar = `${SIDECAR_PREFIX}${currentPrefix}.json`;
    const orphans = entries.filter(
      (name) => name.startsWith(SIDECAR_PREFIX) && name !== keepBin && name !== keepSidecar,
    );
    if (orphans.length === 0) return;
    console.info(`[kvSession] pruning ${orphans.length} orphan file(s)`);
    await Promise.all(
      orphans.map((name) =>
        FileSystem.deleteAsync(toFileUri(joinPath(dir, name)), { idempotent: true }).catch(
          () => undefined,
        ),
      ),
    );
  } catch (e) {
    console.warn('[kvSession] pruneOrphanKvFiles failed:', e);
  }
}

/**
 * Try to restore the system-prompt KV state for `prompt`. Returns true
 * iff the saved state matched the current prompt + runtime AND the
 * native loadSession reported the expected token count.
 *
 * Any failure path (no file, hash mismatch, runtime mismatch, version
 * mismatch, native error, tokens_loaded mismatch) deletes the saved
 * files and returns false. Caller should treat false as "fresh prefill
 * required this turn".
 */
export async function loadSystemPromptKV(ctx: LlamaContext, prompt: string): Promise<boolean> {
  let bin = '';
  let sidecar = '';
  try {
    const { full: hashFull, prefix } = await hashSystemPrompt(prompt);
    const dir = await getKvStateDir();
    const paths = pathsForPrefix(dir, prefix);
    bin = paths.bin;
    sidecar = paths.sidecar;

    const meta = await readSidecar(sidecar);
    if (!meta) return false;

    if (meta.promptHashFull !== hashFull) {
      console.info('[kvSession] hash mismatch — deleting saved state');
      await deleteKvFiles(bin, sidecar);
      return false;
    }
    if (meta.llamaRnVersion !== LLAMA_RN_VERSION) {
      console.info(
        `[kvSession] llama.rn version mismatch (${meta.llamaRnVersion} -> ${LLAMA_RN_VERSION}) — deleting`,
      );
      await deleteKvFiles(bin, sidecar);
      return false;
    }
    if (!runtimeFingerprintMatches(meta.runtime)) {
      console.info('[kvSession] runtime fingerprint mismatch — deleting');
      await deleteKvFiles(bin, sidecar);
      return false;
    }

    const start = Date.now();
    const result = await ctx.native.loadSession(bin);
    const elapsed = Date.now() - start;

    if (result.tokens_loaded !== meta.tokenSize) {
      console.warn(
        `[kvSession] tokens_loaded (${result.tokens_loaded}) != saved tokenSize (${meta.tokenSize}) — invalidating`,
      );
      await deleteKvFiles(bin, sidecar);
      return false;
    }

    console.info(`[kvSession] loaded ${result.tokens_loaded} tokens in ${elapsed}ms`);
    return true;
  } catch (e) {
    console.warn('[kvSession] loadSystemPromptKV failed:', e);
    if (bin && sidecar) {
      await deleteKvFiles(bin, sidecar).catch(() => undefined);
    }
    return false;
  }
}

/**
 * Save the system-prompt slice of the current KV cache to disk.
 *
 * Best-effort: any failure (tokenize error, disk full, write error) is
 * swallowed with a warning. The next launch falls back to fresh prefill.
 *
 * Should be called only AFTER a successful `completion()` that prefilled
 * the system prompt — the KV state must contain it.
 */
export async function saveSystemPromptKV(ctx: LlamaContext, prompt: string): Promise<void> {
  try {
    const tokenizeResult = await ctx.native.tokenize(prompt);
    const tokenSize = tokenizeResult.tokens.length;
    if (tokenSize <= 0) {
      console.warn('[kvSession] tokenize returned empty — skipping save');
      return;
    }

    const { full: hashFull, prefix } = await hashSystemPrompt(prompt);
    const dir = await ensureKvStateDir();
    const { bin, sidecar } = pathsForPrefix(dir, prefix);

    const start = Date.now();
    await ctx.native.saveSession(bin, { tokenSize });
    const sidecarMeta: KvSidecar = {
      promptHashFull: hashFull,
      promptByteLength: prompt.length,
      tokenSize,
      llamaRnVersion: LLAMA_RN_VERSION,
      runtime: {
        n_ctx: INFERENCE_RUNTIME.n_ctx,
        n_batch: INFERENCE_RUNTIME.n_batch,
        cache_type_k: INFERENCE_RUNTIME.cache_type_k,
        cache_type_v: INFERENCE_RUNTIME.cache_type_v,
      },
      savedAt: Date.now(),
    };
    await FileSystem.writeAsStringAsync(toFileUri(sidecar), JSON.stringify(sidecarMeta));
    const elapsed = Date.now() - start;
    console.info(`[kvSession] saved ${tokenSize} tokens in ${elapsed}ms`);

    // New state is durable on disk — now clean up any files left over
    // from prior prompt versions. Best-effort; orphan cleanup never
    // runs before the new save lands, so a prune failure can't strand
    // us without a usable saved state.
    await pruneOrphanKvFiles(prefix);
  } catch (e) {
    console.warn('[kvSession] saveSystemPromptKV failed:', e);
  }
}

/**
 * Delete every saved KV-state file under the kv-state directory.
 * Called by future settings UI when the user changes the model
 * directory — KV state saved against a now-released context is unsafe
 * to restore.
 */
export async function deleteSavedKV(): Promise<void> {
  try {
    const dir = await getKvStateDir();
    const info = await FileSystem.getInfoAsync(toFileUri(dir));
    if (!info.exists) return;
    const entries = await FileSystem.readDirectoryAsync(toFileUri(dir));
    await Promise.all(
      entries
        .filter((name) => name.startsWith(SIDECAR_PREFIX))
        .map((name) =>
          FileSystem.deleteAsync(toFileUri(joinPath(dir, name)), { idempotent: true }).catch(
            () => undefined,
          ),
        ),
    );
  } catch (e) {
    console.warn('[kvSession] deleteSavedKV failed:', e);
  }
}
