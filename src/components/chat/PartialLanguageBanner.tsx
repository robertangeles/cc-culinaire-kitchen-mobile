/**
 * PartialLanguageBanner — stubbed during the backend-chat pivot.
 *
 * The v1.2 banner surfaced state from the on-device promptCacheService
 * (404'd language slug → fallback to EN). That service has been removed
 * for the backend-chat refactor; until the backend equivalent ships,
 * the banner renders nothing. The component is preserved so callers in
 * ChatScreen keep compiling.
 */
export function PartialLanguageBanner() {
  return null;
}
