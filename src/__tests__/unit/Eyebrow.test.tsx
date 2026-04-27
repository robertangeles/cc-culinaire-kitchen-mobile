import { render } from '@testing-library/react-native';

import { Eyebrow } from '@/components/ui/Eyebrow';

describe('Eyebrow', () => {
  it('renders text with uppercase token style', () => {
    const { getByText, toJSON } = render(<Eyebrow>On device</Eyebrow>);
    expect(getByText('On device')).toBeTruthy();
    expect(toJSON()).toMatchSnapshot();
  });
});
