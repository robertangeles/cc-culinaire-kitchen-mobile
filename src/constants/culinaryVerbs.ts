/**
 * Culinary verbs (present-progressive, sentence case) shown in the
 * streaming bubble during the prefill wait — between sending a message
 * and the first token landing. Visual aliveness so the chat doesn't
 * look stuck during ~30–90s cold-prefill stretches on the device.
 *
 * Voice rules (CLAUDE.md design system):
 * - Sentence case
 * - No emoji
 * - No marketing language
 * - Calm head chef — actions a working chef performs at the pass
 *
 * Used by `ChatList` via the inline `useRotatingCulinaryVerb` hook.
 * Keep additions terse, kitchen-grounded, and unambiguous to a
 * non-cook (no obscure technique names that look like typos).
 *
 * Count: 84. Don't drop below 78 — the bubble can show ~40 verbs on a
 * cold first-launch turn without repeating, and we want headroom.
 */
export const CULINARY_VERBS = [
  'searing',
  'braising',
  'deglazing',
  'reducing',
  'folding',
  'kneading',
  'tempering',
  'julienning',
  'brunoising',
  'chiffonading',
  'blanching',
  'poaching',
  'simmering',
  'sautéing',
  'roasting',
  'basting',
  'brining',
  'curing',
  'smoking',
  'dehydrating',
  'emulsifying',
  'whisking',
  'beating',
  'whipping',
  'sifting',
  'dredging',
  'breading',
  'rolling',
  'scoring',
  'butterflying',
  'trussing',
  'trimming',
  'dicing',
  'mincing',
  'slicing',
  'chopping',
  'grating',
  'zesting',
  'peeling',
  'paring',
  'coring',
  'husking',
  'shucking',
  'deboning',
  'filleting',
  'tenderising',
  'seasoning',
  'marinating',
  'glazing',
  'garnishing',
  'plating',
  'charring',
  'caramelising',
  'browning',
  'infusing',
  'steeping',
  'clarifying',
  'rendering',
  'melting',
  'toasting',
  'pickling',
  'fermenting',
  'proofing',
  'shaping',
  'broiling',
  'grilling',
  'frying',
  'steaming',
  'parboiling',
  'drizzling',
  'sprinkling',
  'finishing',
  'carving',
  'crimping',
  'flambéing',
  'mounting',
  'macerating',
  'mashing',
  'spooning',
  'piping',
  'quartering',
  'shredding',
  'stewing',
  'tossing',
] as const;

export type CulinaryVerb = (typeof CULINARY_VERBS)[number];
