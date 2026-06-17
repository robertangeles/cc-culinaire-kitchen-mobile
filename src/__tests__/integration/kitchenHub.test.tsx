import { fireEvent, render } from '@testing-library/react-native';

import { KitchenHubScreen } from '@/components/kitchen/KitchenHubScreen';

// Override the global expo-router mock with a stable push spy so we can
// assert navigation. The hub only consumes useRouter().push.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: jest.fn(), back: jest.fn() }),
}));

describe('KitchenHubScreen', () => {
  beforeEach(() => mockPush.mockClear());

  it('renders the 3 section headers and 11 feature rows', () => {
    const { getByText } = render(<KitchenHubScreen />);
    // Section headers (Eyebrow uppercases visually; underlying text unchanged).
    expect(getByText('Creative Labs')).toBeTruthy();
    expect(getByText('Kitchen Operations')).toBeTruthy();
    expect(getByText('Community')).toBeTruthy();
    // A sample row from each section.
    expect(getByText('Recipe Lab')).toBeTruthy();
    expect(getByText('Waste Intelligence')).toBeTruthy();
    expect(getByText('The Bench')).toBeTruthy();
  });

  it('every placeholder row announces "coming soon" to screen readers (all 11)', () => {
    // The SoonChip is decorative + a11y-hidden (so it does not double-announce);
    // the accessible signal lives on the row label. All 11 rows are placeholders.
    const { queryAllByLabelText } = render(<KitchenHubScreen />);
    expect(queryAllByLabelText(/coming soon/i)).toHaveLength(11);
  });

  it('renders the decorative "Soon" chip on every placeholder row (all 11)', () => {
    const { queryAllByText } = render(<KitchenHubScreen />);
    expect(queryAllByText('Soon', { includeHiddenElements: true })).toHaveLength(11);
  });

  it('navigates to the nested placeholder route on row press', () => {
    const { getByText } = render(<KitchenHubScreen />);
    fireEvent.press(getByText('Recipe Lab'));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(tabs)/kitchen/[slug]',
      params: { slug: 'recipe-lab' },
    });
  });
});
