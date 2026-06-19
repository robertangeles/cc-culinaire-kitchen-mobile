/**
 * Supplier types — mirror the web backend `GET /api/inventory/suppliers`
 * contract (api-contracts.md Endpoint I), field names verbatim, the same way
 * `conversationService`'s `BackendConversation` mirrors Endpoint F. No
 * client-side renaming layer: the screens read `supplierName` etc. directly.
 *
 * Reads are gated on `inventory:count` (a free Subscriber holds it). Writes
 * (PATCH) stay on `inventory:manage`, so the edit affordance is only shown to
 * users whose token carries that permission.
 *
 * Notes verified against the real handlers (ingredientController/Service):
 *   - `GET /suppliers` returns ONLY active rows (`activeInd = true`); there is
 *     no `GET /suppliers/:id`, so detail is a client-side pick from the list.
 *   - `activeInd` is NOT PATCH-editable (absent from the update schema);
 *     deactivation is a manage-only soft-delete. The narrow edit therefore
 *     covers contact fields + notes only — see `SupplierPatch`.
 */

/** One supplier row as returned by `GET /api/inventory/suppliers`. */
export interface Supplier {
  supplierId: string;
  organisationId: number;
  supplierName: string;
  contactName: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  suburb: string | null;
  state: string | null;
  country: string | null;
  postcode: string | null;
  supplierCategory: string;
  paymentTerms: string;
  orderingMethod: string;
  deliveryDays: string;
  currency: string;
  leadTimeDays: number | null;
  minimumOrderValue: string;
  notes: string | null;
  deliveryWindowStart: string | null;
  deliveryWindowEnd: string | null;
  activeInd: boolean;
  createdDttm: string;
  updatedDttm: string;
}

/**
 * The narrow, online-only edit payload sent to `PATCH /suppliers/:id`. Every
 * field is optional (partial update — the backend's `UpdateSupplierSchema` is
 * all-optional). Deliberately limited to the fields a phone fixes in passing;
 * full-row editing stays on web.
 */
export interface SupplierPatch {
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  notes?: string | null;
}
