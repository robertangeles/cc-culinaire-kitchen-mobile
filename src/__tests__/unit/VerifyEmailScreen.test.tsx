import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { VerifyEmailScreen } from '@/components/auth/VerifyEmailScreen';
import * as authService from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types/auth';

jest.mock('@/services/authService');

const mockUser: AuthUser = {
  userId: 1,
  userName: 'Test',
  userEmail: 'a@b.com',
  emailVerified: false,
  mfaEnabled: false,
  userPhotoPath: null,
  freeSessions: 0,
  subscriptionStatus: 'active',
  subscriptionTier: 'free',
  userStatus: 'active',
  roles: [],
  permissions: [],
};

describe('VerifyEmailScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useAuthStore.setState({
      user: mockUser,
      token: 'tok',
      refreshToken: 'rt',
      isHydrated: true,
    });
  });

  it('shows the email passed in', () => {
    const { getByText } = render(<VerifyEmailScreen email="show@me.com" />);
    expect(getByText(/show@me.com/)).toBeTruthy();
  });

  it('calls getMe and shows hint when emailVerified is still false', async () => {
    (authService.getMe as jest.Mock).mockResolvedValue({ ...mockUser, emailVerified: false });
    const { getByText } = render(<VerifyEmailScreen email="a@b.com" />);
    fireEvent.press(getByText('I verified, continue'));
    await waitFor(() => {
      expect(authService.getMe).toHaveBeenCalled();
    });
    await waitFor(() => {
      expect(getByText(/Still not verified/)).toBeTruthy();
    });
  });

  it('calls resendEmailVerification on Resend email', async () => {
    (authService.resendEmailVerification as jest.Mock).mockResolvedValue(undefined);
    const { getByText } = render(<VerifyEmailScreen email="a@b.com" />);
    fireEvent.press(getByText('Resend email'));
    await waitFor(() => {
      expect(authService.resendEmailVerification).toHaveBeenCalledWith('a@b.com');
    });
  });
});
