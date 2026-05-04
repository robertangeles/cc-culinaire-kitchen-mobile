/**
 * deviceInfo — small, memoized provider for the closed `device_info`
 * shape sent inside the feedback payload when the user opts into
 * diagnostic info.
 *
 * Privacy invariant: the shape is intentionally CLOSED. Server-side
 * zod is `.strict()` and will reject unknown keys. NEVER add IP, MAC,
 * advertising ID, user agent, or anything else here without an explicit
 * privacy review (per `wiki/concepts/privacy-invariant.md` and the
 * 2026-05-04 CEO plan privacy-invariant section).
 *
 * Sources (all native/synchronous reads, computed once at module load):
 *   - app_version : expo-application Application.nativeApplicationVersion
 *   - device_model: expo-device Device.modelName
 *   - os_name     : Platform.OS
 *   - os_version  : Platform.Version (string-coerced)
 *   - locale      : expo-localization Localization.locale
 */
import * as Application from 'expo-application';
import * as Device from 'expo-device';
import { getLocales } from 'expo-localization';
import { Platform } from 'react-native';

export interface DeviceInfo {
  app_version: string;
  device_model: string;
  os_name: string;
  os_version: string;
  locale: string;
}

let cached: DeviceInfo | null = null;

export function deviceInfo(): DeviceInfo {
  if (cached) return cached;
  cached = {
    app_version: Application.nativeApplicationVersion ?? 'unknown',
    device_model: Device.modelName ?? 'unknown',
    os_name: Platform.OS,
    os_version: String(Platform.Version),
    locale: getLocales()[0]?.languageTag ?? 'en-US',
  };
  return cached;
}

/** Test-only: clear the memoized value so a fresh read happens on next call. */
export function __resetDeviceInfoForTests(): void {
  cached = null;
}
