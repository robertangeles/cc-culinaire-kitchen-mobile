/**
 * Unit tests for cookieAuthHeaders — the chat/conversation surface (Endpoints
 * E + F) authenticates via the `access_token` cookie, NOT `Authorization`.
 */
import { cookieAuthHeaders } from '@/services/webBackendAuth';

describe('cookieAuthHeaders', () => {
  it('builds the access_token cookie from a JWT', () => {
    expect(cookieAuthHeaders('jwt-abc')).toEqual({ Cookie: 'access_token=jwt-abc' });
  });

  it('never emits an Authorization header', () => {
    expect(cookieAuthHeaders('jwt-abc')).not.toHaveProperty('Authorization');
  });

  it('returns an empty object when there is no token', () => {
    expect(cookieAuthHeaders(null)).toEqual({});
  });

  it('treats an empty-string token as no token', () => {
    expect(cookieAuthHeaders('')).toEqual({});
  });
});
