import {
  getKitchenItem,
  itemsForSection,
  KITCHEN_NAV_ITEMS,
  KITCHEN_SECTIONS,
} from '@/constants/kitchenNav';

describe('kitchenNav config', () => {
  it('has 11 placeholder destinations across 3 sections (Chat excluded)', () => {
    expect(KITCHEN_NAV_ITEMS).toHaveLength(11);
    expect(KITCHEN_SECTIONS.map((s) => s.id)).toEqual([
      'creative-labs',
      'kitchen-operations',
      'community',
    ]);
  });

  it('groups items 3 / 6 / 2 by section, totalling 11', () => {
    expect(itemsForSection('creative-labs')).toHaveLength(3);
    expect(itemsForSection('kitchen-operations')).toHaveLength(6);
    expect(itemsForSection('community')).toHaveLength(2);
  });

  it('every item starts as a placeholder with a unique slug and an i18n labelKey', () => {
    const slugs = KITCHEN_NAV_ITEMS.map((i) => i.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const item of KITCHEN_NAV_ITEMS) {
      expect(item.status).toBe('placeholder');
      expect(item.labelKey).toMatch(/^kitchen\.items\./);
      expect(item.icon.length).toBeGreaterThan(0);
    }
  });

  it('resolves a known slug and returns undefined for an unknown one', () => {
    expect(getKitchenItem('recipe-lab')?.section).toBe('creative-labs');
    expect(getKitchenItem('not-a-real-slug')).toBeUndefined();
    expect(getKitchenItem(undefined)).toBeUndefined();
  });
});
