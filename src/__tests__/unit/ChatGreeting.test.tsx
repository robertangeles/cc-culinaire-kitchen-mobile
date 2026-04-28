import { act, render, waitFor } from '@testing-library/react-native';

import { ChatGreeting } from '@/components/chat/ChatGreeting';
import { HELLOS } from '@/constants/hellos';
import { useAuthStore } from '@/store/authStore';
import type { AuthUser } from '@/types/auth';

const mockUser: AuthUser = {
  userId: 1,
  userName: 'Robert Angeles',
  userEmail: 'robert@example.com',
  emailVerified: true,
  mfaEnabled: false,
  userPhotoPath: null,
  freeSessions: 0,
  subscriptionStatus: 'active',
  subscriptionTier: 'free',
  userStatus: 'active',
  roles: [],
  permissions: [],
};

describe('ChatGreeting', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    useAuthStore.setState({
      user: mockUser,
      token: 'tok',
      refreshToken: 'rt',
      isHydrated: true,
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the first name from userName + initial Hello', () => {
    const { getByText } = render(<ChatGreeting />);
    expect(getByText(/Robert/)).toBeTruthy();
    expect(getByText(HELLOS[0])).toBeTruthy();
    expect(getByText('How can I help you today?')).toBeTruthy();
  });

  it('rotates the Hello word after the cadence elapses', async () => {
    const { getByText, queryByText } = render(<ChatGreeting />);
    expect(getByText(HELLOS[0])).toBeTruthy();
    act(() => {
      jest.advanceTimersByTime(3_500);
    });
    await waitFor(() => {
      expect(queryByText(HELLOS[1])).toBeTruthy();
    });
  });

  it('falls back to "chef" when userName is empty', () => {
    useAuthStore.setState({
      user: { ...mockUser, userName: '' },
      token: 'tok',
      refreshToken: 'rt',
      isHydrated: true,
    });
    const { getByText } = render(<ChatGreeting />);
    expect(getByText(/chef/)).toBeTruthy();
  });
});
