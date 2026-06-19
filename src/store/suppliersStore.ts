import { create } from 'zustand';

import { isApiError, isNetworkError } from '@/services/__errors__';
import * as suppliersService from '@/services/suppliersService';
import type { Supplier, SupplierPatch } from '@/types/supplier';

// ---------------------------------------------------------------------------
// Suppliers — BASE slice (backend-only)
//
// Source of truth is the web backend `GET /api/inventory/suppliers`
// (api-contracts.md Endpoint I). This base store holds the fetched list +
// a status machine; it does NOT yet keep a local SQLite mirror — that is the
// separate E1 stacked PR. Detail is a client-side pick from `suppliers` (there
// is no `GET /suppliers/:id`). Edits go straight to the backend and replace the
// row in place on success.
// ---------------------------------------------------------------------------

/**
 * - `idle`    — never loaded.
 * - `loading` — a fetch is in flight.
 * - `ready`   — loaded; `suppliers` is authoritative (may be empty if the org
 *               genuinely has no active suppliers).
 * - `no-org`  — the caller belongs to no organisation (backend 400). An
 *               onboarding state, NOT an error.
 * - `error`   — a network or server error; `error` holds plain-language copy.
 */
export type SuppliersStatus = 'idle' | 'loading' | 'ready' | 'no-org' | 'error';

interface SuppliersStore {
  suppliers: Supplier[];
  status: SuppliersStatus;
  /** Plain-language message for the `error` status; null otherwise. */
  error: string | null;
  /** Fetch (or re-fetch, e.g. pull-to-refresh) the supplier list. Never throws. */
  hydrate: () => Promise<void>;
  /**
   * Apply a narrow contact/notes edit. Resolves with the updated row and
   * replaces it in the list; REJECTS on failure so the edit sheet can keep the
   * form dirty and surface an inline error (the list is never the source of
   * truth for a pending edit).
   */
  editSupplier: (supplierId: string, patch: SupplierPatch) => Promise<Supplier>;
}

/** Map a thrown error to plain-language copy (never expose raw errors — CLAUDE.md). */
function readErrorMessage(e: unknown): string {
  if (isNetworkError(e)) return "You're offline. Check your connection and try again.";
  if (isApiError(e) && e.status === 403) return "Suppliers isn't available on your account.";
  return 'Something went wrong loading suppliers. Try again.';
}

export const useSuppliersStore = create<SuppliersStore>((set) => ({
  suppliers: [],
  status: 'idle',
  error: null,

  hydrate: async () => {
    set({ status: 'loading', error: null });
    try {
      const rows = await suppliersService.listSuppliers();
      set({ suppliers: rows, status: 'ready', error: null });
    } catch (e) {
      if (suppliersService.isNoOrganisationError(e)) {
        set({ suppliers: [], status: 'no-org', error: null });
      } else {
        set({ status: 'error', error: readErrorMessage(e) });
      }
    }
  },

  editSupplier: async (supplierId, patch) => {
    const updated = await suppliersService.updateSupplier(supplierId, patch);
    set((state) => ({
      suppliers: state.suppliers.map((s) => (s.supplierId === supplierId ? updated : s)),
    }));
    return updated;
  },
}));
