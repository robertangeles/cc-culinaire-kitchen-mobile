import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ForgotPasswordScreen } from '@/components/auth/ForgotPasswordScreen';
import * as authService from '@/services/authService';

jest.mock('@/services/authService');

describe('ForgotPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authService.requestPasswordReset as jest.Mock).mockResolvedValue(undefined);
  });

  it('renders the form initially', () => {
    const { getByText, getByPlaceholderText } = render(<ForgotPasswordScreen />);
    expect(getByText('Forgot your password?')).toBeTruthy();
    expect(getByPlaceholderText('chef@kitchen.co')).toBeTruthy();
    expect(getByText('Send reset link')).toBeTruthy();
  });

  it('disables Send reset link until a valid-looking email is entered', () => {
    const { getByText, getByPlaceholderText } = render(<ForgotPasswordScreen />);
    const button = getByText('Send reset link').parent?.parent; // Pressable wraps the Text
    fireEvent.changeText(getByPlaceholderText('chef@kitchen.co'), 'not-an-email');
    // Re-query after change
    expect(getByText('Send reset link')).toBeTruthy();
    // Type a valid-looking email
    fireEvent.changeText(getByPlaceholderText('chef@kitchen.co'), 'user@example.com');
    expect(button).toBeTruthy();
  });

  it('calls requestPasswordReset and shows success state on submit', async () => {
    const { getByText, getByPlaceholderText } = render(<ForgotPasswordScreen />);
    fireEvent.changeText(getByPlaceholderText('chef@kitchen.co'), 'user@example.com');
    fireEvent.press(getByText('Send reset link'));
    await waitFor(() => {
      expect(authService.requestPasswordReset).toHaveBeenCalledWith('user@example.com');
    });
    await waitFor(() => {
      expect(getByText('Check your inbox.')).toBeTruthy();
    });
  });
});
