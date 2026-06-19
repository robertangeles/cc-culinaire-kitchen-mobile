import { useCallback } from 'react';

import { useAuthStore } from '@/store/authStore';
import { useSuppliersStore } from '@/store/suppliersStore';
import type { Supplier } from '@/types/supplier';

/**
 * Permission a token must carry to edit a supplier. Reads stay on
 * `inventory:count` (every Subscriber holds it); writes require this manage
 * tier, so a read-only user simply never sees the edit affordance.
 */
const SUPPLIER_EDIT_PERMISSION = 'inventory:manage';

/**
 * useSuppliers — the screen-facing interface over `suppliersStore`. Components
 * never touch the store or service directly. Detail is resolved client-side
 * via `getSupplier` (there is no `GET /suppliers/:id`).
 */
export function useSuppliers() {
  const suppliers = useSuppliersStore((s) => s.suppliers);
  const status = useSuppliersStore((s) => s.status);
  const error = useSuppliersStore((s) => s.error);
  const hydrate = useSuppliersStore((s) => s.hydrate);
  const editSupplier = useSuppliersStore((s) => s.editSupplier);

  const canEdit = useAuthStore(
    (s) => s.user?.permissions?.includes(SUPPLIER_EDIT_PERMISSION) ?? false,
  );

  const getSupplier = useCallback(
    (supplierId: string): Supplier | undefined =>
      suppliers.find((s) => s.supplierId === supplierId),
    [suppliers],
  );

  return { suppliers, status, error, hydrate, editSupplier, canEdit, getSupplier };
}
