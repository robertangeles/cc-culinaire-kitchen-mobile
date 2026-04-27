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
    const img = getByLabelText('CulinAIre Kitchen');
    const flat = Array.isArray(img.props.style)
      ? Object.assign({}, ...img.props.style.flat())
      : img.props.style;
    expect(flat).toMatchObject({ width: 120, height: 120 });
  });
});
