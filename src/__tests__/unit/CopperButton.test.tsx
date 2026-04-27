import { fireEvent, render } from '@testing-library/react-native';

import { CopperButton } from '@/components/ui/CopperButton';

describe('CopperButton', () => {
  it('renders children as label', () => {
    const { getByText } = render(<CopperButton>Get started</CopperButton>);
    expect(getByText('Get started')).toBeTruthy();
  });

  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByRole } = render(<CopperButton onPress={onPress}>Tap</CopperButton>);
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('suppresses onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByRole } = render(
      <CopperButton onPress={onPress} disabled>
        Tap
      </CopperButton>,
    );
    fireEvent.press(getByRole('button'));
    expect(onPress).not.toHaveBeenCalled();
  });
});
