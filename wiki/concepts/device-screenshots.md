---
title: Capturing screenshots from the Moto G86 Power
category: concept
created: 2026-05-03
updated: 2026-05-03
related: [[in-flight]]
---

How to grab a PNG screenshot from the connected Android device without
fighting PowerShell binary redirection or Git Bash MSYS path translation.

## TL;DR — use this exact PowerShell one-liner

```powershell
$dir = "$env:TEMP\culinaire-kitchen"
if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir | Out-Null }
$stamp = Get-Date -Format "yyyyMMdd-HHmmss"
$path  = "$dir\screen-$stamp.png"
adb shell "screencap -p /sdcard/screen.png"
adb pull /sdcard/screen.png $path
adb shell "rm /sdcard/screen.png"
Write-Output "saved: $path"
```

Then `Read` the saved file path with the Read tool — Claude Code can render PNGs inline.

## Why not the obvious approaches

Three things that **look** like they should work but silently corrupt or fail. Burned ~6 minutes learning these on 2026-05-03.

### ❌ `adb exec-out screencap -p > file.png` from PowerShell

PowerShell `>` redirection runs every byte through string conversion (UTF-16 by default). The PNG header gets mangled and the file is unreadable. Only works in `cmd.exe`, not PowerShell.

**Fix:** use `adb shell` + `adb pull` instead — `pull` writes raw bytes to disk via the platform-tools binary, no shell redirection involved.

### ❌ `adb shell "screencap -p /sdcard/x.png"` from Git Bash

Git Bash's MSYS layer rewrites any argument that starts with `/` into a Windows path before handing it to the program. `/sdcard/screen.png` becomes `C:/Program Files/Git/sdcard/screen.png`, which doesn't exist on the device, and `screencap` prints its usage banner instead of capturing.

**Fix:** prefix with `MSYS_NO_PATHCONV=1` for the remote-path commands. But then Git Bash _also_ stops translating the local destination path, so `adb pull` writes the file to the wrong place.

### ❌ Mixed `MSYS_NO_PATHCONV=1` from Git Bash

Trying to disable path conversion only for the remote arg and keep it for the local arg requires running each `adb` invocation with its own env var setting, which is brittle and confusing.

**Fix:** just use PowerShell. Windows env vars (`$env:TEMP`) and Windows-style paths flow through `adb` cleanly with zero translation.

## Conventions

- **Always save under `$env:TEMP\culinaire-kitchen\`** (per user preference — see auto-memory `feedback_diagnostic_temp_dir`). Never bare `%TEMP%`.
- **Filename pattern:** `screen-YYYYMMDD-HHMMSS.png`. Sortable, no collisions.
- **Always delete the on-device copy** (`adb shell "rm /sdcard/screen.png"`) so it doesn't accumulate.
- **The Moto G86 Power is the primary test device.** Serial `ZY32MB62DD`. If `adb devices` shows multiple, add `-s ZY32MB62DD` to each adb call.

## Related — diagnostics on the same device

Other useful one-shots while the device is connected:

```powershell
# Tail logcat into the same temp dir, filtered to ReactNative + the app's package
adb logcat -d ReactNative:V ReactNativeJS:V *:S > "$env:TEMP\culinaire-kitchen\logcat-$(Get-Date -Format yyyyMMdd-HHmmss).log"

# Live-stream logcat (Ctrl-C to stop)
adb logcat ReactNative:V ReactNativeJS:V *:S

# Restart Metro reverse-tunnel (fixes "Unable to load script" red-screen)
adb reverse tcp:8081 tcp:8081
```
