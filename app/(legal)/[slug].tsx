import { useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { LegalPageScreen } from '@/components/legal/LegalPageScreen';
import { SITE_PAGE_SLUGS, type SitePageSlug } from '@/constants/config';

/**
 * Dynamic legal-page route. Slug comes from the URL — e.g.
 * `/(legal)/terms` maps to slug=terms, `/(legal)/privacy` to
 * slug=privacy. Anything else falls back to "terms" so a stale or
 * mistyped link still lands somewhere reasonable.
 *
 * The screen fetches the body via siteService against
 * `GET /api/site-pages/:slug?surface=mobile` and renders the markdown
 * natively via LegalPageScreen.
 */
export default function LegalRoute() {
  const { t } = useTranslation();
  const { slug } = useLocalSearchParams<{ slug?: string }>();

  const safeSlug: SitePageSlug =
    typeof slug === 'string' && (Object.values(SITE_PAGE_SLUGS) as string[]).includes(slug)
      ? (slug as SitePageSlug)
      : SITE_PAGE_SLUGS.terms;

  const fallbackTitle =
    safeSlug === SITE_PAGE_SLUGS.privacy ? t('legal.privacyTitle') : t('legal.termsTitle');

  return <LegalPageScreen slug={safeSlug} fallbackTitle={fallbackTitle} />;
}
