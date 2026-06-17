import type Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

/**
 * Kitchen navigation config — the single source of truth for the Kitchen
 * hub, the placeholder route, and (later) deep links + web↔mobile feature
 * parity.
 *
 * Mirrors the web sidebar (Chat Assistant lives in its own tab, so it is
 * NOT listed here). Porting a feature to mobile is a one-line change:
 * flip `status` to 'live' and point the row at the real screen. The
 * "Soon" chip + the placeholder both key off `status`.
 *
 *   sections                 items
 *   ────────────────         ──────────────────────────────────────────
 *   creative-labs      ──▶   Recipe Lab · Patisserie Lab · Spirits Lab
 *   kitchen-operations ──▶   My Recipe Book · Stock Room · Purchasing ·
 *                            Menu Intelligence · Kitchen Copilot ·
 *                            Waste Intelligence
 *   community          ──▶   CulinAIre Recipe Book · The Bench
 */

type FeatherIconName = ComponentProps<typeof Feather>['name'];

export type KitchenSectionId = 'creative-labs' | 'kitchen-operations' | 'community';

/** 'placeholder' = not built on mobile yet (shows "Soon" + placeholder screen). */
export type KitchenItemStatus = 'placeholder' | 'live';

export interface KitchenNavItem {
  /** URL-safe id; also the dynamic-route param (`/(tabs)/kitchen/<slug>`). */
  slug: string;
  /** i18n key for the display label (resolved via `t()`). */
  labelKey: string;
  /** Feather glyph name. Provisional picks — confirm against design. */
  icon: FeatherIconName;
  section: KitchenSectionId;
  status: KitchenItemStatus;
}

export interface KitchenSection {
  id: KitchenSectionId;
  /** i18n key for the section header (rendered in an Eyebrow). */
  labelKey: string;
}

export const KITCHEN_SECTIONS: readonly KitchenSection[] = [
  { id: 'creative-labs', labelKey: 'kitchen.sections.creativeLabs' },
  { id: 'kitchen-operations', labelKey: 'kitchen.sections.kitchenOperations' },
  { id: 'community', labelKey: 'kitchen.sections.community' },
] as const;

export const KITCHEN_NAV_ITEMS: readonly KitchenNavItem[] = [
  // Creative Labs
  {
    slug: 'recipe-lab',
    labelKey: 'kitchen.items.recipeLab',
    icon: 'book-open',
    section: 'creative-labs',
    status: 'placeholder',
  },
  {
    slug: 'patisserie-lab',
    labelKey: 'kitchen.items.patisserieLab',
    icon: 'coffee',
    section: 'creative-labs',
    status: 'placeholder',
  },
  {
    slug: 'spirits-lab',
    labelKey: 'kitchen.items.spiritsLab',
    icon: 'droplet',
    section: 'creative-labs',
    status: 'placeholder',
  },
  // Kitchen Operations
  {
    slug: 'my-recipe-book',
    labelKey: 'kitchen.items.myRecipeBook',
    icon: 'book',
    section: 'kitchen-operations',
    status: 'placeholder',
  },
  {
    slug: 'stock-room',
    labelKey: 'kitchen.items.stockRoom',
    icon: 'archive',
    section: 'kitchen-operations',
    status: 'placeholder',
  },
  {
    slug: 'purchasing',
    labelKey: 'kitchen.items.purchasing',
    icon: 'shopping-cart',
    section: 'kitchen-operations',
    status: 'placeholder',
  },
  {
    slug: 'menu-intelligence',
    labelKey: 'kitchen.items.menuIntelligence',
    icon: 'bar-chart-2',
    section: 'kitchen-operations',
    status: 'placeholder',
  },
  {
    slug: 'kitchen-copilot',
    labelKey: 'kitchen.items.kitchenCopilot',
    icon: 'cpu',
    section: 'kitchen-operations',
    status: 'placeholder',
  },
  {
    slug: 'waste-intelligence',
    labelKey: 'kitchen.items.wasteIntelligence',
    icon: 'trash-2',
    section: 'kitchen-operations',
    status: 'placeholder',
  },
  // Community
  {
    slug: 'culinaire-recipe-book',
    labelKey: 'kitchen.items.culinaireRecipeBook',
    icon: 'globe',
    section: 'community',
    status: 'placeholder',
  },
  {
    slug: 'the-bench',
    labelKey: 'kitchen.items.theBench',
    icon: 'users',
    section: 'community',
    status: 'placeholder',
  },
] as const;

/** Items belonging to a section, in declared order. */
export function itemsForSection(section: KitchenSectionId): KitchenNavItem[] {
  return KITCHEN_NAV_ITEMS.filter((item) => item.section === section);
}

/** Resolve a slug to its nav item, or `undefined` for an unknown slug. */
export function getKitchenItem(slug: string | undefined): KitchenNavItem | undefined {
  return KITCHEN_NAV_ITEMS.find((item) => item.slug === slug);
}
