/**
 * Model locator. Resolves where Antoine's GGUF files live on disk.
 *
 * The background download service (PR #4) lands files at
 *   `{filesDir}/models/{MODEL.id}/v1/{filename}`
 * via the native BackgroundDownloadModule. This module is the JS-side
 * resolver that the inference layer calls to find them.
 *
 * Optional override: SecureStore key STORAGE_KEYS.modelDir lets a future
 * Settings UI redirect to an alternate base directory. If unset, we fall
 * back to the native module's document directory.
 *
 * Privacy invariant: this file does NOT make network calls. It only
 * reads paths from local storage.
 */
import * as FileSystem from 'expo-file-system/legacy';
import * as SecureStore from 'expo-secure-store';
import { NativeModules } from 'react-native';

import { MODEL, STORAGE_KEYS } from '@/constants/config';

import type { BackgroundDownloadNativeModule } from './types/backgroundDownload';

const SUBDIRECTORY = `models/${MODEL.id}/v1`;

function getNativeModule(): BackgroundDownloadNativeModule | null {
  const mod = (NativeModules as Record<string, unknown>).BackgroundDownloadModule;
  return (mod as BackgroundDownloadNativeModule | undefined) ?? null;
}

/**
 * Returns the bare app document directory (no subdir). Used by services
 * that store non-model files under app-private storage — e.g.,
 * `kvSessionService` keeps saved KV state under `<docDir>/kv-state/`.
 *
 * The model-files subdirectory is layered on top via `getBaseDir()`.
 */
export async function getDocumentDirectoryBase(): Promise<string> {
  const native = getNativeModule();
  if (!native) {
    throw new Error(
      'BackgroundDownloadModule is not registered. Run `pnpm android` to rebuild the dev client.',
    );
  }
  return native.getDocumentDirectory();
}

async function getBaseDir(): Promise<string> {
  const override = await SecureStore.getItemAsync(STORAGE_KEYS.modelDir);
  if (override && override.length > 0) return override;
  const filesDir = await getDocumentDirectoryBase();
  return joinPath(filesDir, SUBDIRECTORY);
}

export function joinPath(...parts: string[]): string {
  return parts
    .map((p, i) => (i === 0 ? p.replace(/\/+$/, '') : p.replace(/^\/+|\/+$/g, '')))
    .filter((p) => p.length > 0)
    .join('/');
}

export async function getMainModelPath(): Promise<string> {
  const base = await getBaseDir();
  return joinPath(base, MODEL.files.main.filename);
}

export interface VerifyResult {
  ok: boolean;
  missing: string[];
}

/**
 * `expo-file-system`'s `getInfoAsync` expects a URI-style path
 * (`file://...`), not a bare filesystem path. The native
 * BackgroundDownloadModule's `getDocumentDirectory()` returns a bare
 * path like `/data/user/0/<pkg>/files`, so we prepend `file://` here
 * for the existence check. Without this, getInfoAsync silently returns
 * `{exists: false}` even when the file is on disk.
 */
export function toFileUri(path: string): string {
  if (path.startsWith('file://')) return path;
  return `file://${path}`;
}

export async function verifyModelFiles(): Promise<VerifyResult> {
  const main = await getMainModelPath();
  const mainInfo = await FileSystem.getInfoAsync(toFileUri(main));
  const missing: string[] = [];
  if (!mainInfo.exists) missing.push(MODEL.files.main.filename);
  return { ok: missing.length === 0, missing };
}
