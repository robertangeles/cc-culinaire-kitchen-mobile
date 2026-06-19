/**
 * suppliersService — read/edit client for `/api/inventory/suppliers`
 * (api-contracts.md Endpoint I). Thin by design: maps each route to one
 * function. The suppliers store calls these; screens and components never do.
 *
 * Auth: `Authorization: Bearer` (apiClient default) — the inventory surface
 * uses Bearer, unlike the chat/conversation surface which uses the cookie.
 *
 * Permission tiers (enforced server-side): reads need `inventory:count` (a
 * free Subscriber holds it); `updateSupplier` (PATCH) needs `inventory:manage`
 * and will throw `ApiError(403)` for a read-only user — the UI gates the edit
 * affordance on the token's permissions so that 403 is never hit in practice.
 */
import type { Supplier, SupplierPatch } from '@/types/supplier';

import { apiClient } from './apiClient';
import { isApiError } from './__errors__';

const SUPPLIERS_PATH = '/api/inventory/suppliers';

/**
 * List the caller's organisation suppliers (active only; the backend filters
 * `activeInd = true`). Returns the array directly — the endpoint is not
 * envelope-wrapped. Throws `ApiError(400)` when the caller has no organisation
 * (see `isNoOrganisationError`).
 */
export async function listSuppliers(): Promise<Supplier[]> {
  return apiClient.get<Supplier[]>(SUPPLIERS_PATH);
}

/**
 * Partial-update a supplier's contact fields / notes. Returns the updated row.
 * `inventory:manage` only. Throws `ApiError(400)` on validation failure (e.g.
 * a malformed `contactEmail`), `ApiError(404)` if the supplier is not found.
 */
export async function updateSupplier(supplierId: string, patch: SupplierPatch): Promise<Supplier> {
  return apiClient.patch<Supplier>(`${SUPPLIERS_PATH}/${encodeURIComponent(supplierId)}`, patch);
}

/**
 * True when a `listSuppliers` error means "the caller belongs to no
 * organisation" — the backend returns 400 from its org-resolution guard. The
 * list endpoint's only 400 case is the no-org one, so this is status-based,
 * not coupled to the message string. The store maps it to an empty/onboarding
 * state, NOT an error.
 */
export function isNoOrganisationError(e: unknown): boolean {
  return isApiError(e) && e.status === 400;
}
