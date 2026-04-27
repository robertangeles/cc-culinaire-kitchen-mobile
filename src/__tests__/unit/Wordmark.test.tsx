import { render } from '@testing-library/react-native';

import { Wordmark } from '@/components/ui/Wordmark';

describe('Wordmark', () => {
  it.each(['sm', 'md', 'lg'] as const)('renders at size=%s', (size) => {
    const { toJSON, getByText } = render(<Wordmark size={size} />);
    expect(getByText('CULINAIRE')).toBeTruthy();
    expect(getByText('Kitchen')).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });
});
