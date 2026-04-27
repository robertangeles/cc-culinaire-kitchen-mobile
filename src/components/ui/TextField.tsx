import { type ReactNode, useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { fonts, layout, palette, radii } from '@/constants/theme';

interface TextFieldProps extends Omit<
  TextInputProps,
  'style' | 'value' | 'onChangeText' | 'onChange'
> {
  label: string;
  value: string;
  onChange: (next: string) => void;
  leading?: ReactNode;
  trailing?: ReactNode;
}

export function TextField({
  label,
  value,
  onChange,
  leading,
  trailing,
  secureTextEntry,
  placeholder,
  autoFocus,
  autoCapitalize,
  autoComplete,
  keyboardType,
  ...rest
}: TextFieldProps) {
  const [focused, setFocused] = useState(false);

  const onFocus = useCallback(() => setFocused(true), []);
  const onBlur = useCallback(() => setFocused(false), []);

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.fieldRow, focused && styles.focused]}>
        {leading}
        <TextInput
          {...rest}
          value={value}
          onChangeText={onChange}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          placeholderTextColor={palette.inkFaint}
          secureTextEntry={secureTextEntry}
          autoFocus={autoFocus}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          keyboardType={keyboardType}
          style={styles.input}
        />
        {trailing}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: palette.copperDeep,
    fontFamily: fonts.uiBold,
    fontSize: 11,
    letterSpacing: 1.76,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: palette.paperDeep,
    borderRadius: radii.sm + 2,
    borderWidth: 1,
    borderColor: palette.paperEdge,
    paddingHorizontal: 14,
    minHeight: layout.tap + 8,
  },
  focused: {
    borderColor: palette.copper,
    shadowColor: palette.copper,
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  input: {
    flex: 1,
    fontFamily: fonts.ui,
    fontSize: 16,
    color: palette.ink,
    paddingVertical: 0,
  },
});
