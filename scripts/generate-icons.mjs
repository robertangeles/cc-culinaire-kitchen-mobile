#!/usr/bin/env node
/**
 * Generate launcher + splash icon assets from the brand mark.
 *
 * Source:  assets/brand/ck-logo.png  (2048x2048, full lockup: knife + plate
 *          + chickpeas + "CULINAIRE" wordmark + "Kitchen" cursive script,
 *          transparent background)
 *
 * Outputs:
 *   assets/images/icon.png                    iOS + fallback (paper bg, no alpha)
 *   assets/images/android-icon-foreground.png Android adaptive layer (transparent)
 *   assets/images/android-icon-monochrome.png Android 13+ themed icon silhouette
 *   assets/images/splash-icon.png             First-launch splash glyph
 *
 * Why: Expo's `prebuild` doesn't generate icons — it copies whatever's at the
 * configured paths into the native android/ resource folders. The asset paths
 * in app.config.ts must therefore point at production-quality PNGs we own.
 *
 * Android adaptive icon math:
 *   - Total canvas: 108dp
 *   - Safe zone (visible after circular/squircle mask): 66dp = 61% of canvas
 *   - At 1024px canvas, safe zone is ~625px centered
 *
 * Monochrome silhouette gotcha: a naive alpha-channel copy loses detail
 * because the source has anti-aliased thin strokes (knife outline, plate
 * rings, chickpea contours) that go sub-50% alpha and disappear when scaled
 * down. We threshold the alpha — anything > ~30% becomes fully opaque white
 * — before joining it to the white plate. Preserves the silhouette structure
 * the OS will recolor.
 *
 * Run with: node scripts/generate-icons.mjs
 */
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

import sharp from 'sharp';

// Editorial palette (per src/constants/theme.ts + CLAUDE.md design system).
const PAPER = '#F3EFE4';

// Canonical sizes.
const ICON_SIZE = 1024;            // iOS + fallback
const ADAPTIVE_SIZE = 1024;        // Android adaptive layers
const SPLASH_SIZE = 400;           // Splash glyph (backgroundColor surrounds)

// Safe-zone ratio for Android adaptive icons. Anything outside this circle
// can be clipped by aggressive launcher masks.
const SAFE_ZONE_RATIO = 0.61;

const REPO_ROOT = path.resolve(import.meta.dirname, '..');
const SOURCE = path.join(REPO_ROOT, 'assets', 'brand', 'ck-logo.png');
const OUT_DIR = path.join(REPO_ROOT, 'assets', 'images');

if (!existsSync(SOURCE)) {
  console.error(`Source not found: ${SOURCE}`);
  process.exit(1);
}
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

/**
 * Resize the source glyph so it fits within `safePx` of the target canvas,
 * centered, with transparency around. Returns a PNG buffer.
 */
async function fitToSafeZone(canvas, safePx) {
  const resized = await sharp(SOURCE)
    .resize(safePx, safePx, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  return sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function writeIcon() {
  const out = path.join(OUT_DIR, 'icon.png');
  // iOS + fallback: paper background visible around the glyph (no transparency
  // — iOS rejects icons with alpha). Logo at safe zone for visual consistency
  // with the adaptive icon.
  const safe = Math.round(ICON_SIZE * SAFE_ZONE_RATIO);
  const fg = await fitToSafeZone(ICON_SIZE, safe);
  await sharp({
    create: {
      width: ICON_SIZE,
      height: ICON_SIZE,
      channels: 3,
      background: PAPER,
    },
  })
    .composite([{ input: fg, gravity: 'center' }])
    .png()
    .toFile(out);
  console.log(`✓ ${path.relative(REPO_ROOT, out)} (${ICON_SIZE}x${ICON_SIZE}, paper bg)`);
}

async function writeAdaptiveForeground() {
  const out = path.join(OUT_DIR, 'android-icon-foreground.png');
  const safe = Math.round(ADAPTIVE_SIZE * SAFE_ZONE_RATIO);
  const buf = await fitToSafeZone(ADAPTIVE_SIZE, safe);
  await sharp(buf).toFile(out);
  console.log(`✓ ${path.relative(REPO_ROOT, out)} (${ADAPTIVE_SIZE}x${ADAPTIVE_SIZE}, transparent, safe zone ${safe}px)`);
}

async function writeMonochrome() {
  // Themed icons (Android 13+): single-color silhouette derived from the
  // source's alpha channel. The OS recolors it per the user's themed-icon
  // palette, so we need a clean white-on-transparent mask.
  //
  // Naive alpha-channel copy disappears at small sizes because the source's
  // anti-aliased thin strokes go sub-50% alpha. Threshold the alpha at ~25%
  // so faint edges become solid (every visible stroke survives the recolour).
  const out = path.join(OUT_DIR, 'android-icon-monochrome.png');
  const safe = Math.round(ADAPTIVE_SIZE * SAFE_ZONE_RATIO);
  const safeFg = await fitToSafeZone(ADAPTIVE_SIZE, safe);

  // Threshold the alpha: anything > 25% → fully opaque, else fully transparent.
  // Sharp's threshold operates on grayscale, so we extract alpha as grayscale
  // first, threshold, then re-attach.
  const ALPHA_THRESHOLD = 64; // 25% of 255
  const thresholdedAlpha = await sharp(safeFg)
    .extractChannel('alpha')
    .threshold(ALPHA_THRESHOLD)
    .toBuffer();

  const white = await sharp({
    create: { width: ADAPTIVE_SIZE, height: ADAPTIVE_SIZE, channels: 3, background: '#FFFFFF' },
  })
    .png()
    .toBuffer();
  await sharp(white)
    .joinChannel(thresholdedAlpha)
    .png()
    .toFile(out);
  console.log(`✓ ${path.relative(REPO_ROOT, out)} (${ADAPTIVE_SIZE}x${ADAPTIVE_SIZE}, white-on-alpha silhouette, threshold ${ALPHA_THRESHOLD}/255)`);
}

async function writeSplash() {
  // Splash mirrors the welcome screen's slide 1 hero — full brand lockup
  // (knife + plate + chickpeas + "CULINAIRE" + "Kitchen") with a copper
  // hairline "LITE" pill tucked just below it, centered, on transparent
  // background (the splash plugin's backgroundColor draws the paper around).
  // Matches the BrandGlyph + LiteBadge composition used at:
  //   src/components/welcome/WelcomeCarousel.tsx → slide 1
  //   src/components/ui/BrandGlyph.tsx           → hero lockup
  //   src/components/ui/LiteBadge.tsx            → pill spec (copper outline,
  //                                                copper text, ~18% letter-spacing)
  const out = path.join(OUT_DIR, 'splash-icon.png');

  // SQUARE canvas. Android 12+ SplashScreen API clips the splash icon to a
  // square (or circular, depending on launcher), so a portrait PNG gets
  // top/bottom-cropped. Tested on Moto G86 Power: portrait 1000x1200 lost
  // the top of the plate AND the bottom of the LITE pill on first run.
  // Square fits both logo and pill without cropping.
  const W = 1000;
  const H = 1000;

  // Logo fills the top ~78% of the canvas, leaving room for the pill below
  // without either cramping. Tighter than the welcome screen because we
  // also need the pill in-frame.
  const LOGO_BOX = 780;
  const logoBuf = await sharp(SOURCE)
    .resize(LOGO_BOX, LOGO_BOX, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // LITE pill via SVG composite. Mirrors LiteBadge.tsx geometry:
  //   - Hairline copper outline (#B87840)
  //   - Copper text, bold, letter-spaced ~18% of font size
  //   - Rounded corners (4px at scale=1; we scale up to PNG dimensions)
  // Sharp uses librsvg for SVG → PNG; falls back to system fonts (Helvetica /
  // Arial) since Inter isn't available at PNG-bake time. Visual difference vs
  // Inter is negligible at four-character ALL CAPS pill scale.
  const PILL_W = 220;
  const PILL_H = 80;
  const STROKE = 3;
  const COPPER = '#B87840';
  const FONT_SIZE = 42;
  const pillSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PILL_W}" height="${PILL_H}" viewBox="0 0 ${PILL_W} ${PILL_H}">
  <rect x="${STROKE / 2}" y="${STROKE / 2}" width="${PILL_W - STROKE}" height="${PILL_H - STROKE}" rx="14" ry="14" fill="none" stroke="${COPPER}" stroke-width="${STROKE}"/>
  <text x="${PILL_W / 2}" y="${PILL_H * 0.72}" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${FONT_SIZE}" letter-spacing="${FONT_SIZE * 0.18}" fill="${COPPER}" text-anchor="middle">LITE</text>
</svg>`;
  const pillBuf = await sharp(Buffer.from(pillSvg)).png().toBuffer();

  // Vertical placement: logo + pill stack centered in the square canvas.
  // Pill pulled up slightly into the logo's bottom whitespace — same -8%
  // overlap that BrandGlyph applies via marginTop: -size * 0.08.
  const overlap = Math.round(LOGO_BOX * 0.08);
  const stackHeight = LOGO_BOX + PILL_H - overlap;
  const stackTop = Math.round((H - stackHeight) / 2);
  const logoLeft = Math.round((W - LOGO_BOX) / 2);
  const logoTop = stackTop;
  const pillTop = stackTop + LOGO_BOX - overlap;
  const pillLeft = Math.round((W - PILL_W) / 2);

  await sharp({
    create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      { input: logoBuf, left: logoLeft, top: logoTop },
      { input: pillBuf, left: pillLeft, top: pillTop },
    ])
    .png()
    .toFile(out);
  console.log(`✓ ${path.relative(REPO_ROOT, out)} (${W}x${H}, logo + LITE pill stacked + centered, transparent)`);
}

console.log(`Generating icons from ${path.relative(REPO_ROOT, SOURCE)}...\n`);
await writeIcon();
await writeAdaptiveForeground();
await writeMonochrome();
await writeSplash();
console.log('\nDone. Next: pnpm prebuild --clean && pnpm android');
