/**
 * Unit tests for suppliersStore — the backend-only base slice. The service's
 * network functions are mocked; `isNoOrganisationError` is kept REAL (via
 * requireActual) so the store's no-org branch is exercised against the genuine
 * predicate + ApiError class.
 */
/* eslint-disable import/first */
jest.mock('@/services/suppliersService', () => ({
  __esModule: true,
  ...jest.requireActual('@/services/suppliersService'),
  listSuppliers: jest.fn(),
  updateSupplier: jest.fn(),
}));

import { ApiError, NetworkError } from '@/services/__errors__';
import * as suppliersService from '@/services/suppliersService';
import { useSuppliersStore } from '@/store/suppliersStore';
import type { Supplier } from '@/types/supplier';
/* eslint-enable import/first */

const mkSupplier = (id: string, over: Partial<Supplier> = {}): Supplier => ({
  supplierId: id,
  organisationId: 1,
  supplierName: `Supplier ${id}`,
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  addressLine1: null,
  addressLine2: null,
  suburb: null,
  state: null,
  country: null,
  postcode: null,
  supplierCategory: 'food',
  paymentTerms: 'net30',
  orderingMethod: 'email',
  deliveryDays: 'mon',
  currency: 'AUD',
  leadTimeDays: 1,
  minimumOrderValue: '0',
  notes: null,
  deliveryWindowStart: null,
  deliveryWindowEnd: null,
  activeInd: true,
  createdDttm: '2026-06-19T00:00:00.000Z',
  updatedDttm: '2026-06-19T00:00:00.000Z',
  ...over,
});

const listMock = suppliersService.listSuppliers as jest.Mock;
const updateMock = suppliersService.updateSupplier as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  useSuppliersStore.setState({ suppliers: [], status: 'idle', error: null });
});

describe('suppliersStore.hydrate', () => {
  it('loads suppliers and goes ready on success', async () => {
    listMock.mockResolvedValueOnce([mkSupplier('a'), mkSupplier('b')]);
    await useSuppliersStore.getState().hydrate();
    const s = useSuppliersStore.getState();
    expect(s.status).toBe('ready');
    expect(s.suppliers).toHaveLength(2);
    expect(s.error).toBeNull();
  });

  it('maps a 400 (no organisation) to the no-org state, not an error', async () => {
    listMock.mockRejectedValueOnce(new ApiError(400, 'You are not a member of any organisation'));
    await useSuppliersStore.getState().hydrate();
    const s = useSuppliersStore.getState();
    expect(s.status).toBe('no-org');
    expect(s.suppliers).toEqual([]);
    expect(s.error).toBeNull();
  });

  it('maps a network failure to an error status with offline copy', async () => {
    listMock.mockRejectedValueOnce(new NetworkError());
    await useSuppliersStore.getState().hydrate();
    const s = useSuppliersStore.getState();
    expect(s.status).toBe('error');
    expect(s.error).toMatch(/offline/i);
  });

  it('maps a 403 to an error status with account copy', async () => {
    listMock.mockRejectedValueOnce(new ApiError(403, 'Insufficient permissions.'));
    await useSuppliersStore.getState().hydrate();
    expect(useSuppliersStore.getState().status).toBe('error');
    expect(useSuppliersStore.getState().error).toMatch(/account/i);
  });
});

describe('suppliersStore.editSupplier', () => {
  it('replaces the edited row in place and resolves with it', async () => {
    useSuppliersStore.setState({ suppliers: [mkSupplier('a'), mkSupplier('b')], status: 'ready' });
    updateMock.mockResolvedValueOnce(mkSupplier('a', { notes: 'COD only' }));

    const result = await useSuppliersStore.getState().editSupplier('a', { notes: 'COD only' });

    expect(result.notes).toBe('COD only');
    const a = useSuppliersStore.getState().suppliers.find((s) => s.supplierId === 'a');
    expect(a?.notes).toBe('COD only');
    // untouched row stays as-is
    expect(
      useSuppliersStore.getState().suppliers.find((s) => s.supplierId === 'b')?.notes,
    ).toBeNull();
  });

  it('rejects on failure and leaves the list unchanged (form keeps dirty edit)', async () => {
    useSuppliersStore.setState({ suppliers: [mkSupplier('a')], status: 'ready' });
    updateMock.mockRejectedValueOnce(new ApiError(400, 'Validation failed'));

    await expect(
      useSuppliersStore.getState().editSupplier('a', { contactEmail: 'bad' }),
    ).rejects.toThrow(ApiError);
    // unchanged
    expect(useSuppliersStore.getState().suppliers[0]?.contactEmail).toBeNull();
  });
});
