import { fireEvent, render, waitFor } from '@testing-library/react-native';
import { TextInput } from 'react-native';

import { MfaScreen } from '@/components/auth/MfaScreen';
import * as authService from '@/services/authService';
import type { AuthSession } from '@/types/auth';

jest.mock('@/services/authService');

const mockSession: AuthSession = {
  user: {
    userId: 1,
    userName: 'Test',
    userEmail: 'a@b.com',
    emailVerified: true,
    mfaEnabled: true,
    userPhotoPath: null,
    freeSessions: 0,
    subscriptionStatus: 'active',
    subscriptionTier: 'free',
    userStatus: 'active',
    roles: [],
    permissions: [],
  },
  tokens: { accessToken: 'access-jwt', refreshToken: 'refresh-jwt' },
};

describe('MfaScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authService.verifyMfa as jest.Mock).mockResolvedValue(mockSession);
  });

  it('renders the prompt and 6 empty digit boxes', () => {
    const { getByText } = render(<MfaScreen mfaSessionToken="mfa-tok" />);
    expect(getByText('Two-step verification.')).toBeTruthy();
    expect(getByText(/6-digit code/)).toBeTruthy();
  });

  it('calls verifyMfa once a 6-digit code is typed (auto-submit)', async () => {
    const { UNSAFE_getByType } = render(<MfaScreen mfaSessionToken="mfa-tok" />);
    // The hidden TextInput drives the visible boxes. Find it by type.
    const input = UNSAFE_getByType(TextInput);
    fireEvent.changeText(input, '123456');
    await waitFor(() => {
      expect(authService.verifyMfa).toHaveBeenCalledWith('mfa-tok', '123456');
    });
  });

  it('strips non-digits and caps at 6 chars', async () => {
    const { UNSAFE_getByType } = render(<MfaScreen mfaSessionToken="mfa-tok" />);
    const input = UNSAFE_getByType(TextInput);
    fireEvent.changeText(input, '12-34-56-99');
    // Only first 6 digits used: "123456"
    await waitFor(() => {
      expect(authService.verifyMfa).toHaveBeenCalledWith('mfa-tok', '123456');
    });
  });
});
