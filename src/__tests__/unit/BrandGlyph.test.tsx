import { render } from '@testing-library/react-native';

import { BrandGlyph } from '@/components/ui/BrandGlyph';

describe('BrandGlyph', () => {
  it('renders the lockup image by default', () => {
    const tree = render(<BrandGlyph />);
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it('renders the icon-only crop when compact', () => {
    const tree = render(<BrandGlyph compact size={48} />);
    expect(tree.toJSON()).toMatchSnapshot();
  });

  it('respects size prop', () => {
    const { getByLabelText } = render(<BrandGlyph size={120} />);
    // size=120 + non-compact → Lite badge is on by default → label
    // is the Lite-aware variant.
    const img = getByLabelText('CulinAIre Kitchen Lite');
    const flat = Array.isArray(img.props.style)
      ? Object.assign({}, ...img.props.style.flat())
      : img.props.style;
    expect(flat).toMatchObject({ width: 120, height: 120 });
  });

  it('omits the Lite badge for tiny compact icons (chat header etc.)', () => {
    const { getByLabelText, queryByText } = render(<BrandGlyph compact size={28} />);
    // compact + tiny → no badge → original label, no LITE text node.
    expect(getByLabelText('CulinAIre Kitchen')).toBeTruthy();
    expect(queryByText('LITE')).toBeNull();
  });

  it('shows the Lite badge by default on hero-size lockup', () => {
    const { getByText } = render(<BrandGlyph size={240} />);
    expect(getByText('LITE')).toBeTruthy();
  });
});
