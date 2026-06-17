/**
 * webBackendAuth — auth headers for the chat + conversation surface.
 *
 * Unlike the mobile-only Endpoints A–D (which use `Authorization: Bearer`
 * via apiClient), the chat streaming endpoint (`POST /api/chat`) and the
 * conversation persistence endpoints (`/api/conversations/*`) authenticate
 * through the web backend's `authenticateOrGuest` middleware, which reads
 * the JWT from the `access_token` **cookie** — NOT an Authorization header
 * (see shared-context/api-contracts.md, Endpoints E and F).
 *
 * Mobile has no guest flow — the app is subscription-gated, so a logged-in
 * user is always present. We therefore only ever send the cookie form; the
 * `X-Guest-Token` header path is a web-only concern. When no token is
 * present we return no auth header so the server replies with a clean
 * `401 { error: "Authentication required." }` that the UI can surface.
 */

/**
 * Build the cookie auth header for a chat/conversation request. Returns an
 * empty object when there is no token, so callers can spread it
 * unconditionally.
 */
export function cookieAuthHeaders(token: string | null): Record<string, string> {
  return token ? { Cookie: `access_token=${token}` } : {};
}
