import { fireEvent, render } from '@testing-library/react-native';

import { TextField } from '@/components/ui/TextField';

describe('TextField', () => {
  it('renders the label and current value', () => {
    const { getByText, getByDisplayValue } = render(
      <TextField label="Email" value="hello@x.com" onChange={jest.fn()} />,
    );
    expect(getByText('Email')).toBeTruthy();
    expect(getByDisplayValue('hello@x.com')).toBeTruthy();
  });

  it('calls onChange with typed text', () => {
    const onChange = jest.fn();
    const { getByDisplayValue } = render(<TextField label="Email" value="" onChange={onChange} />);
    fireEvent.changeText(getByDisplayValue(''), 'a@b.com');
    expect(onChange).toHaveBeenCalledWith('a@b.com');
  });

  it('honors secureTextEntry', () => {
    const { getByDisplayValue } = render(
      <TextField label="Password" value="x" onChange={jest.fn()} secureTextEntry />,
    );
    expect(getByDisplayValue('x').props.secureTextEntry).toBe(true);
  });
});
