import { fireEvent, render } from '@testing-library/react-native';

import { GhostButton } from '@/components/ui/GhostButton';

describe('GhostButton', () => {
  it('renders + onPress', () => {
    const onPress = jest.fn();
    const { getByText, getByRole } = render(
      <GhostButton onPress={onPress}>Choose later</GhostButton>,
    );
    expect(getByText('Choose later')).toBeTruthy();
    fireEvent.press(getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
