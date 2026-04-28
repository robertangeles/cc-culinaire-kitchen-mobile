import { fireEvent, render, waitFor } from '@testing-library/react-native';

import { ResetPasswordScreen } from '@/components/auth/ResetPasswordScreen';
import * as authService from '@/services/authService';

jest.mock('@/services/authService');

describe('ResetPasswordScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (authService.submitPasswordReset as jest.Mock).mockResolvedValue(undefined);
  });

  it('pre-fills the token from initialToken prop', () => {
    const { getByDisplayValue } = render(<ResetPasswordScreen initialToken="reset-tok-123" />);
    expect(getByDisplayValue('reset-tok-123')).toBeTruthy();
  });

  it('disables Reset password until token + 8-char password entered', () => {
    const { getByText, getByPlaceholderText } = render(<ResetPasswordScreen />);
    expect(getByText('Reset password')).toBeTruthy();
    fireEvent.changeText(getByPlaceholderText('From the email link'), 'tok');
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'short');
    expect(getByText('Reset password')).toBeTruthy();
    // Now type a valid 8-char password.
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'longenough1');
    expect(getByText('Reset password')).toBeTruthy();
  });

  it('calls submitPasswordReset and shows success state', async () => {
    const { getByText, getByPlaceholderText } = render(<ResetPasswordScreen />);
    fireEvent.changeText(getByPlaceholderText('From the email link'), 'reset-tok-xyz');
    fireEvent.changeText(getByPlaceholderText('At least 8 characters'), 'NewPassword1');
    fireEvent.press(getByText('Reset password'));
    await waitFor(() => {
      expect(authService.submitPasswordReset).toHaveBeenCalledWith('reset-tok-xyz', 'NewPassword1');
    });
    await waitFor(() => {
      expect(getByText('Password reset.')).toBeTruthy();
    });
  });
});
