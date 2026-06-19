/**
 * Unit tests for suppliersService — the `/api/inventory/suppliers`
 * (Endpoint I) client. apiClient is mocked so we assert the exact routes,
 * bodies, and (Bearer-default) auth each function passes.
 */
/* eslint-disable import/first */
jest.mock('@/services/apiClient', () => ({
  apiClient: {
    get: jest.fn(),
    post: jest.fn(async () => undefined),
    patch: jest.fn(),
    del: jest.fn(async () => undefined),
    request: jest.fn(async () => undefined),
  },
}));

import { apiClient } from '@/services/apiClient';
import { ApiError, NetworkError } from '@/services/__errors__';
import * as suppliersService from '@/services/suppliersService';
import type { Supplier, SupplierPatch } from '@/types/supplier';
/* eslint-enable import/first */

beforeEach(() => jest.clearAllMocks());

describe('suppliersService', () => {
  it('listSuppliers GETs the suppliers path with Bearer default (no auth option)', async () => {
    const rows = [{ supplierId: 's1' }, { supplierId: 's2' }] as Supplier[];
    (apiClient.get as jest.Mock).mockResolvedValueOnce(rows);

    const result = await suppliersService.listSuppliers();

    expect(apiClient.get).toHaveBeenCalledWith('/api/inventory/suppliers');
    expect(result).toHaveLength(2);
    expect(result[0]?.supplierId).toBe('s1');
  });

  it('updateSupplier PATCHes the encoded id with the partial body', async () => {
    const patch: SupplierPatch = { contactPhone: '0400 000 000', notes: 'COD only' };
    (apiClient.patch as jest.Mock).mockResolvedValueOnce({ supplierId: 's1', ...patch });

    const result = await suppliersService.updateSupplier('s1', patch);

    expect(apiClient.patch).toHaveBeenCalledWith('/api/inventory/suppliers/s1', patch);
    expect(result.supplierId).toBe('s1');
  });

  it('updateSupplier URL-encodes the supplier id', async () => {
    (apiClient.patch as jest.Mock).mockResolvedValueOnce({});
    await suppliersService.updateSupplier('a/b c', { notes: 'x' });
    expect(apiClient.patch).toHaveBeenCalledWith('/api/inventory/suppliers/a%2Fb%20c', {
      notes: 'x',
    });
  });

  it('propagates errors from apiClient', async () => {
    (apiClient.get as jest.Mock).mockRejectedValueOnce(new NetworkError());
    await expect(suppliersService.listSuppliers()).rejects.toThrow(NetworkError);
  });

  describe('isNoOrganisationError', () => {
    it('is true for a 400 ApiError (the no-org case)', () => {
      expect(
        suppliersService.isNoOrganisationError(
          new ApiError(400, 'You are not a member of any organisation'),
        ),
      ).toBe(true);
    });

    it('is false for a 403 ApiError (insufficient permissions)', () => {
      expect(
        suppliersService.isNoOrganisationError(new ApiError(403, 'Insufficient permissions.')),
      ).toBe(false);
    });

    it('is false for a non-ApiError', () => {
      expect(suppliersService.isNoOrganisationError(new NetworkError())).toBe(false);
      expect(suppliersService.isNoOrganisationError(new Error('boom'))).toBe(false);
    });
  });
});
