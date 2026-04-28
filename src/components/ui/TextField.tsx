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
          // Android Autofill (triggered by `autoComplete`) tears down the IME
          // session immediately after focus, causing the keyboard to flash open
          // and close. Disabling autofill on these fields stops the cascade.
          // See logcat sequence: SHOW → AssistStructure scan → HIDE_SOFT_INPUT_CLOSE_CURRENT_SESSION.
          importantForAutofill="no"
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
    // Only borderColor changes on focus — no elevation/shadow. On Android,
    // adding elevation on focus causes a 1–2px layout shift which can tear
    // down the IME session immediately (HIDE_SOFT_INPUT_CLOSE_CURRENT_SESSION).
    // iOS shadows are visual-only and don't affect layout, so this is fine.
    borderColor: palette.copper,
  },
  input: {
    flex: 1,
    fontFamily: fonts.ui,
    fontSize: 16,
    color: palette.ink,
    paddingVertical: 0,
  },
});
