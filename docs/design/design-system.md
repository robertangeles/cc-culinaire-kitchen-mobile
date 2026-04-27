# CulinAIre Kitchen — Design System

> AI Kitchen Systems — built for real chefs and restaurant owners.

CulinAIre Kitchen is a multi-module operating system for working culinary
professionals — built for the line cook fixing a broken hollandaise at
midnight, the restaurateur approving POs across two locations, and the
patissier iterating on a new dough.

The product is **mobile-first**. Every UI element must make the user want to
touch it. That tactility is not optional polish — it is a core design
requirement for every page, component, and interaction.

---

## Sources

This system was built from two reference assets the user provided:

| File                       | Contents                                                                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `assets/logo-wordmark.png` | Cream-background lockup: ink "CULINAIRE" sans + copper "Kitchen" script, with a knot-and-knife monogram.                                       |
| `assets/logo-mark-3d.png`  | Hero render of the same lockup — fingerprint + copper paring-knife monogram, deep ink "CULINAIRE", copper "Kitchen" script over a copper rule. |

No codebase, Figma, or product copy was provided. The visual system is
extrapolated from the two logo renders + the product brief; **product
screens are designed from first principles** in the spirit those references
set, not recreated from existing UI.

---

## Index

- `README.md` — this file. Read first.
- `SKILL.md` — agent skill manifest. Use to invoke this system from Claude Code.
- `colors_and_type.css` — the full token layer (color, type, spacing, radius, shadow, motion). Import this in any artifact.
- `assets/` — logos, monograms, brand textures.
- `fonts/` — webfonts (currently linked from Google Fonts; see Type below).
- `preview/` — design-system spec cards (typography, color, components). These render in the project's Design System tab.
- `ui_kits/app/` — the CulinAIre Kitchen mobile app: `index.html` is a click-thru prototype; the components are split into `*.jsx` modules.

---

## Brand position

| Axis                 | Where CulinAIre lives                                         |
| -------------------- | ------------------------------------------------------------- |
| Tech ↔ Craft         | Hard-craft. AI is the **sous chef**, not the headline.        |
| Cool ↔ Warm          | Warm. Copper, parchment, candle-light, oxidised steel.        |
| Clinical ↔ Editorial | Editorial. Reads like a chef's notebook, not a B2B dashboard. |
| Loud ↔ Quiet         | Quiet confidence. Restraint is the personality.               |

What this system is **not**: glassmorphism, blue-purple gradients, generic
"AI sparkle" iconography, emoji confetti, neon, glow, or any motif that
reads as consumer-tech-startup.

---

## Content fundamentals

The voice is a head chef who happens to be calm. Direct, technical when it
needs to be, and never twee.

### Voice rules

| Rule                | Do                                                                                                                        | Don't                                                          |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| **Person**          | Second person ("you"). First-person plural for product side ("we'll").                                                    | Royal "we" lecturing the user.                                 |
| **Casing**          | Sentence case for UI labels. Title Case for product/brand names. ALL-CAPS only for the wordmark and short eyebrow labels. | TitleCaseOnEverything. SHOUTY paragraph copy.                  |
| **Tone**            | Calm authority. Specific. Numbers and times when possible.                                                                | Marketing adjectives. "Revolutionary," "seamless," "powerful." |
| **Punctuation**     | Em-dashes for asides. Oxford comma. Periods on full sentences only.                                                       | Exclamation points. Ellipses for drama.                        |
| **Emoji / Unicode** | None in product UI. Unicode for true symbols only (°, ½, ×).                                                              | 🔥, ✨, 👨‍🍳, etc.                                               |
| **Numerals**        | Numerals for measurements (350°F, 4 oz, 12 covers). Words for soft counts ≤10 in prose.                                   | "Three hundred and fifty degrees fahrenheit."                  |
| **Time**            | 24-hour in the line ("18:30 service"). 12-hour with AM/PM in customer-facing surfaces.                                    | Mixing the two on one screen.                                  |

### Microcopy examples

| Surface             | Copy                                                                               |
| ------------------- | ---------------------------------------------------------------------------------- |
| Empty state         | "No tickets in the rail. Service starts at 17:30."                                 |
| Error               | "Couldn't reach the printer in Pass 2. Retry, or print to Pass 1."                 |
| Success toast       | "PO sent to Baldor. Delivery window: Tue 06:00–08:00."                             |
| Destructive confirm | "Delete this prep list? It's referenced by tonight's mise."                        |
| AI suggestion       | "Hollandaise broke — likely temp. Try 2 oz warm clarified butter, whisk off heat." |
| Onboarding          | "Add your first station. The line knows itself once it does."                      |
| Notification        | "Quail eggs marked received. 4 short on the invoice — flagged for Marco."          |

### Things never to say

- "Powered by AI." (Imply through utility, not a badge.)
- "Effortless," "delight," "magical," "10x."
- "Hey chef!" / "Welcome back, chef 👨‍🍳"
- Any food pun in a primary action ("Let's get cooking!" → ❌).

---

## Visual foundations

The system is **two materials and three colors**: paper and ink, with copper
as the only accent. Treat copper like saffron — a little goes a long way.

### Palette

| Token           | Hex       | Used for                                                       |
| --------------- | --------- | -------------------------------------------------------------- |
| `--paper`       | `#E8E2D6` | Default app background. Warmer than off-white.                 |
| `--paper-deep`  | `#DCD8D0` | Cards, elevated surfaces against `--paper`.                    |
| `--paper-edge`  | `#C9C2B3` | Hairline borders on paper.                                     |
| `--ink`         | `#101418` | Headings, primary text, primary buttons.                       |
| `--ink-soft`    | `#2A2F36` | Body copy on paper.                                            |
| `--ink-muted`   | `#6B6F76` | Secondary text, captions, metadata.                            |
| `--copper`      | `#B87840` | The accent. Brand, primary action highlight, "Kitchen" script. |
| `--copper-deep` | `#8A5530` | Pressed copper, copper text on dark.                           |
| `--copper-tint` | `#F0E0CE` | Copper-on-paper backgrounds, soft selection.                   |
| `--ember`       | `#C24A28` | Destructive, hot/over-temp signals.                            |
| `--herb`        | `#3F5B3A` | Confirm/healthy/in-stock signals.                              |
| `--saffron`     | `#D9A441` | Warning, expiring stock.                                       |

These are the only colors the product uses. Status colors are picked from the
spice rack (ember, herb, saffron) so the warmth of the brand is preserved
even in error states. **Do not introduce blues, purples, or true greys.**

### Type

Two families, no third:

- **Display + body — `Fraunces`** (variable serif). Soft, modern serif with
  optical sizing. Carries the editorial, chef's-notebook feel. Numbers are
  oldstyle by default; use tabular for tables/timers.
- **UI sans — `Inter`**. For dense UI: chips, table rows, button labels,
  toolbars. Tracked tight.
- **Script — `Caveat`** (substitute for the hand-script in the wordmark).
  Used **only** for the "Kitchen" word in the lockup and for occasional
  signature flourishes. Never for body copy or buttons.

> **Substitution flag:** the wordmark's "Kitchen" script and the "CULINAIRE"
> sans are custom-set in the source PNG. We are using `Caveat` (Google) and
> `Fraunces` (Google) as the closest free substitutes. **If you have the
> original font files, drop them in `fonts/` and update `colors_and_type.css`.**

### Spacing

A 4-px base scale. Mobile prefers 16/20/24 for the primary rhythm.

`4 · 8 · 12 · 16 · 20 · 24 · 32 · 40 · 56 · 80`

### Radii

| Token      | Px  | Used for                  |
| ---------- | --- | ------------------------- |
| `--r-xs`   | 6   | Chips, tags               |
| `--r-sm`   | 10  | Buttons, inputs           |
| `--r-md`   | 16  | Cards, sheets             |
| `--r-lg`   | 24  | Hero cards, modal sheets  |
| `--r-pill` | 999 | Pills, segmented controls |

Corners are **soft, never sharp** (>= 6 on anything tappable) and **never
fully rounded except on pills**. The default card is `--r-md` (16).

### Shadows / elevation

Shadows are warm (cast through `oklch` of ink, not pure black) and **always
soft + low contrast**. We do not use stacked multi-layer shadows.

| Token       | Value (effect)                                                               |
| ----------- | ---------------------------------------------------------------------------- |
| `--e-0`     | none — flat on paper                                                         |
| `--e-1`     | `0 1px 2px rgba(16,20,24,.06), 0 1px 1px rgba(16,20,24,.04)` — chips, inputs |
| `--e-2`     | `0 6px 18px -8px rgba(16,20,24,.18)` — cards                                 |
| `--e-3`     | `0 18px 40px -16px rgba(16,20,24,.30)` — sheets, popovers                    |
| `--e-press` | `inset 0 1px 0 rgba(16,20,24,.06)` — pressed inputs                          |

A subtle **inner highlight** (`inset 0 1px 0 rgba(255,255,255,.5)`) on
copper buttons gives them the candle-lit feel.

### Borders

- Hairline (`1px solid var(--paper-edge)`) is the default border on paper.
- On ink surfaces, borders are `rgba(255,255,255,0.08)`.
- Dividers in lists are 1px, **not** full-width — inset by the content
  padding (a chef's-notebook detail).

### Backgrounds

- The app default is `--paper`. Avoid full-bleed photography in chrome —
  imagery sits **inside** cards.
- An optional **paper-grain texture** (`assets/paper-grain.svg`) overlays
  large surfaces at 4% opacity for tactility. Never on small components.
- No gradients in chrome. The only gradients allowed are:
  1. A long-axis copper gradient on the primary CTA (`--copper` → `--copper-deep`).
  2. A protection gradient (paper → transparent) at the top/bottom of
     scrolling sheets so titles don't collide with content.

### Imagery

When food photography is used: **warm, low-light, slight grain, shallow
depth of field**. Cool/blue/clinical food photos are off-brand. Keep
silverware/copperware visible; over-styled flatlay is off-brand.

### Motion

Motion is **deliberate and short** — like turning a page, not a confetti
cannon.

- **Duration:** 160ms (micro), 240ms (default), 360ms (sheet/page).
- **Easing:** `cubic-bezier(.2, .7, .2, 1)` — a gentle "settle." No bounces.
- **Hover (web/desktop):** `--copper` lifts to `--copper-deep` on text,
  background tints by 4%. No drop-shadow lifts.
- **Press / tap (mobile):** `transform: scale(.97)` + 4% darken of fill.
  Released in 160ms. Every tappable element MUST respond — this is the
  "want to touch it" requirement.
- **Page transitions:** cross-fade with a 4-px upward translate. No slide
  carousels for nav.

### Transparency / blur

Blur is rare. The only blurs:

1. The bottom tab-bar background, blurred 18px to read as a frosted-paper
   layer over content.
2. The keyboard accessory dock, same treatment.

### Tactility — the "want-to-touch" rule

Every interactive element must do **at least one** of:

1. Press-scale to 0.97 with 4% fill darken on tap.
2. Soft inner highlight on buttons.
3. Haptic-equivalent micro-animation on toggle (a 160ms ease).
4. Specimen-quality letterforms (Fraunces optical) on labels.

If a screen has no clear "primary touch surface," the design is wrong.

---

## Iconography

There is no source icon set, sprite, or icon font in the references. To
keep the brand cohesive while staying in copper-on-paper:

- **Set:** `Lucide` (CDN, `lucide@latest`). Stroke-based, 1.75 stroke,
  rounded line caps. **Substitution flagged** — if the team adopts a
  different set later, swap globally.
- **Style rules:** stroke `1.75px`, color `currentColor`, sized in 4px
  increments (16/20/24/28). Filled icons are reserved for selected tab-bar
  states.
- **Brand glyphs:** the knot/knife monogram (`assets/logo-mark-3d.png` —
  cropped square form recommended) is used as the app icon and for empty
  states. Do not redraw it.
- **Emoji:** never in product UI.
- **Unicode:** allowed for true typographic symbols only — `°`, `½`, `×`,
  `→`. Never as decoration.

---

## CSS

`colors_and_type.css` exposes everything as custom properties:

```css
@import url('./colors_and_type.css');
.card {
  background: var(--paper-deep);
  border-radius: var(--r-md);
  box-shadow: var(--e-2);
}
```

Both base tokens (`--ink`, `--copper`) and semantic tokens (`--bg`, `--fg`,
`--surface`, `--surface-elev`, `--text`, `--text-muted`, `--border`,
`--accent`) are defined. Prefer semantic tokens in product code.
