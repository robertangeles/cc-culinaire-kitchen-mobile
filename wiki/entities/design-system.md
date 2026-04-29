---
title: Design system — Paper, Ink, Copper
category: entity
created: 2026-04-29
updated: 2026-04-29
related: [[screens]], [[antoine]]
---

The visual, motion, and voice system used by every screen in CulinAIre Mobile. Two materials and one accent: paper, ink, copper. Built for working chefs, not consumer-tech aesthetics.

> **Source of truth (code):** `src/constants/theme.ts` — palette, semantic tokens, type, radii, spacing, shadows, motion.
> **Source of truth (reference):** `docs/design/design-system.md` — full design system spec (this page is a navigable summary).

## Brand position

| Axis                 | Where CulinAIre lives                                         |
| -------------------- | ------------------------------------------------------------- |
| Tech ↔ Craft         | Hard-craft. AI is the _sous chef_, not the headline.          |
| Cool ↔ Warm          | Warm. Copper, parchment, candle-light, oxidised steel.        |
| Clinical ↔ Editorial | Editorial. Reads like a chef's notebook, not a B2B dashboard. |
| Loud ↔ Quiet         | Quiet confidence. Restraint is the personality.               |

What this system is NOT: glassmorphism, blue-purple gradients, generic AI sparkle iconography, emoji confetti, neon, glow.

## Palette

| Token        | Hex       | Used for                                |
| ------------ | --------- | --------------------------------------- |
| `paper`      | `#E8E2D6` | Default app background                  |
| `paperDeep`  | `#DCD8D0` | Cards, elevated surfaces                |
| `paperEdge`  | `#C9C2B3` | Hairline borders                        |
| `ink`        | `#101418` | Headings, primary text, primary buttons |
| `inkSoft`    | `#2A2F36` | Body copy on paper                      |
| `inkMuted`   | `#6B6F76` | Secondary text, captions                |
| `copper`     | `#B87840` | Brand accent — the only highlight       |
| `copperDeep` | `#8A5530` | Pressed copper, copper text on dark     |
| `copperTint` | `#F0E0CE` | Soft copper backgrounds, badges         |
| `ember`      | `#C24A28` | Destructive, hot/over-temp              |
| `herb`       | `#3F5B3A` | Confirm/healthy/in-stock                |
| `saffron`    | `#D9A441` | Warning, expiring stock                 |

**No blues, purples, or true greys.** Status colors come from the spice rack so warmth is preserved even in errors.

## Type

- **Display + body:** `Fraunces` (variable serif). Editorial chef's-notebook feel.
- **UI sans:** `Inter`. For dense UI: chips, table rows, button labels.
- **Script:** `Caveat`. ONLY for the "Kitchen" word in the wordmark and rare signature flourishes. Never body or buttons.

## Voice — calm head chef

- Sentence case for UI labels. Numerals for measurements (350°F, 4 oz).
- Em-dashes for asides. Oxford comma. No exclamation points.
- **No emoji in product UI.**
- Never "powered by AI", "magical", "10x", "Hey chef!", "Let's get cooking!".
- Errors are specific: not "Something went wrong" but "Couldn't reach the printer in Pass 2. Retry, or print to Pass 1."

## Motion — quiet confidence

- 160ms (micro), 240ms (default), 360ms (sheet/page).
- Easing `cubic-bezier(.2, .7, .2, 1)`. No bounces.
- Press-scale 0.97 + 4% fill darken on every tappable element.
- Page transitions cross-fade with a 4px upward translate. No slide carousels.

## Tactility — the "want-to-touch" rule

Every interactive element MUST do at least one of:

1. Press-scale 0.97 + 4% fill darken
2. Soft inner highlight on buttons
3. Haptic-equivalent micro-animation
4. Specimen-quality letterforms on labels

If a screen has no clear primary touch surface, the design is wrong.

## Solid surfaces — no glass morphism

- The user explicitly rejected backdrop blur during design iteration.
- Blur is reserved for the bottom tab bar + keyboard accessory dock only.
- Never on sheets, popovers, or composer.

## Radii + shadows

- Default card radius: `r-md` (16px). Pills only fully rounded.
- Shadows are warm (cast through ink, low contrast, single layer). No stacked multi-shadow.

## When building new UI

1. Pull tokens from `src/constants/theme.ts` — never hex literals in component code.
2. Use `CopperButton` for primary, `GhostButton` for secondary, `TextField` for inputs.
3. Touch targets minimum 44pt (`layout.tap`).
4. Empty states are paper cards with a copper CTA.
5. Bottom sheets via `@gorhom/bottom-sheet`, not custom panels.
6. Status colors only from `theme.positive | warning | danger`.

## See also

- [[screens]] — every screen renders against this system
- [[antoine]] — the persona's voice was tuned to match
- `docs/design/design-system.md` — full reference (this page is the navigable summary)
- `src/constants/theme.ts` — code source of truth
