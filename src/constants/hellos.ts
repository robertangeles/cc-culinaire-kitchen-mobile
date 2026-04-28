/**
 * Multilingual greetings for the rotating "Hello, <name>" header on the
 * chat empty state. Order is intentional: starts with the user's likely
 * primary language (English), rotates through major spoken languages in
 * a culturally diverse but pronunciation-friendly set.
 *
 * Each entry is a plain string (no transliteration glyphs that screen
 * readers mis-pronounce). Accessibility note: VoiceOver / TalkBack will
 * announce each new greeting on rotation, which is acceptable —
 * culinary professionals using the app are unlikely to leave the screen
 * reader on this view for long.
 */
export const HELLOS = [
  'Hello',
  'Hola',
  'Bonjour',
  'Ciao',
  'Olá',
  'Hallo',
  'Привет',
  'こんにちは',
  '안녕',
  '你好',
  'مرحبا',
  'Namaste',
] as const;

/**
 * Short culinary one-liners shown on the model-download screen to keep
 * users engaged during the 6-7 GB download. Voice: calm head chef.
 * Each tip rotates every ~4 seconds via Reanimated cross-fade.
 *
 * Keep tips short (≤2 lines on a phone), evergreen (no time-sensitive
 * trends), and grounded in technique (no "we use AI to...!" puffery).
 */
export const COOKING_TIPS = [
  'Salt is your friend. Use it earlier than you think.',
  'A sharp knife is a safe knife.',
  'Always preheat the pan before the oil.',
  'Taste as you go. Adjust seasoning at the end.',
  'Rest the meat. Always.',
  'Acid wakes a dish up. Lemon, vinegar, wine — pick one.',
  'Mise en place. Set up before you cook, not while.',
  'A heavy-bottomed pan turns heat into flavour.',
  'Brown is the colour of taste. Don’t crowd the pan.',
  'Read the recipe twice. Then once more before you start.',
] as const;
