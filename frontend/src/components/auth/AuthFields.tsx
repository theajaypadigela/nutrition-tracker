import React, { useMemo, useState } from 'react';
import {
  KeyboardTypeOptions,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AlertCircle,
  Check,
  ChevronDown,
  Eye,
  EyeOff,
  Lock,
  LucideIcon,
} from 'lucide-react-native';
import { T, R, pwStrength } from './authTheme';

// ─── label + footer ────────────────────────────────────────
function FieldLabel({ label, optional }: { label: string; optional?: boolean }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.labelText}>{label}</Text>
      {optional ? (
        <View style={styles.optionalPill}>
          <Text style={styles.optionalText}>Optional</Text>
        </View>
      ) : null}
    </View>
  );
}

function FieldFoot({ error, hint }: { error?: string | false; hint?: string }) {
  if (error) {
    return (
      <View style={styles.footRow} accessibilityRole="alert">
        <AlertCircle size={15} color={T.danger} />
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }
  if (hint) {
    return <Text style={styles.hintText}>{hint}</Text>;
  }
  return null;
}

// ─── text field ────────────────────────────────────────────
export interface AuthTextFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  icon?: LucideIcon;
  placeholder?: string;
  error?: string | false;
  hint?: string;
  optional?: boolean;
  secureTextEntry?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
  trailing?: React.ReactNode;
}

export function AuthTextField({
  label,
  value,
  onChangeText,
  onBlur,
  icon: Icon,
  placeholder,
  error,
  hint,
  optional,
  secureTextEntry,
  keyboardType,
  autoCapitalize = 'none',
  autoComplete,
  trailing,
}: AuthTextFieldProps) {
  const [focus, setFocus] = useState(false);
  const borderColor = error ? T.danger : focus ? T.green : T.line;
  const iconColor = error ? T.danger : focus ? T.green : T.inkMuted;
  return (
    <View>
      <FieldLabel label={label} optional={optional} />
      <View
        style={[
          styles.fieldBox,
          {
            borderColor,
            backgroundColor: focus ? T.surface : T.field,
          },
          focus ? styles.fieldFocusRing : null,
        ]}
      >
        {Icon ? <Icon size={20} color={iconColor} /> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocus(true)}
          onBlur={() => {
            setFocus(false);
            onBlur?.();
          }}
          placeholder={placeholder}
          placeholderTextColor={T.inkMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoComplete={autoComplete}
          style={styles.input}
        />
        {trailing}
      </View>
      <FieldFoot error={error} hint={hint} />
    </View>
  );
}

// ─── password field ────────────────────────────────────────
export function AuthPasswordField({
  label,
  value,
  onChangeText,
  onBlur,
  placeholder,
  error,
  hint,
  strength,
  autoComplete = 'password',
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  error?: string | false;
  hint?: string;
  strength?: boolean;
  autoComplete?: React.ComponentProps<typeof TextInput>['autoComplete'];
}) {
  const [show, setShow] = useState(false);
  const st = useMemo(() => pwStrength(value), [value]);
  return (
    <View>
      <AuthTextField
        label={label}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        icon={Lock}
        placeholder={placeholder}
        error={error}
        hint={hint}
        secureTextEntry={!show}
        autoComplete={autoComplete}
        trailing={
          <Pressable
            onPress={() => setShow(s => !s)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={show ? 'Hide password' : 'Show password'}
          >
            {show ? (
              <EyeOff size={20} color={T.inkMuted} />
            ) : (
              <Eye size={20} color={T.inkMuted} />
            )}
          </Pressable>
        }
      />
      {strength && !!value && !error ? (
        <View style={styles.strengthRow}>
          <View style={styles.strengthTrack}>
            {[0, 1, 2, 3].map(i => (
              <View
                key={i}
                style={[
                  styles.strengthBar,
                  { backgroundColor: i < Math.max(1, st.score) ? st.color : T.line },
                ]}
              />
            ))}
          </View>
          <Text style={[styles.strengthLabel, { color: st.color }]}>{st.label}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── tappable picker field (DOB / time) ────────────────────
export function PickerField({
  label,
  value,
  placeholder,
  icon: Icon,
  onPress,
  error,
  optional,
  active,
}: {
  label: string;
  value: string;
  placeholder?: string;
  icon?: LucideIcon;
  onPress: () => void;
  error?: string | false;
  optional?: boolean;
  active?: boolean;
}) {
  const has = !!value;
  const borderColor = error ? T.danger : active ? T.green : T.line;
  const iconColor = error ? T.danger : active ? T.green : T.inkMuted;
  return (
    <View>
      <FieldLabel label={label} optional={optional} />
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        style={[
          styles.fieldBox,
          { borderColor, backgroundColor: active ? T.surface : T.field },
          active ? styles.fieldFocusRing : null,
        ]}
      >
        {Icon ? <Icon size={20} color={iconColor} /> : null}
        <Text
          style={[styles.pickerValue, { color: has ? T.ink : T.inkMuted }]}
          numberOfLines={1}
        >
          {has ? value : placeholder}
        </Text>
        <ChevronDown size={18} color={T.inkMuted} />
      </Pressable>
      <FieldFoot error={error} />
    </View>
  );
}

// ─── gender chips ──────────────────────────────────────────
export function GenderChips({
  label,
  options,
  value,
  onChange,
  error,
}: {
  label: string;
  options: { label: string; value: string }[];
  value: string;
  onChange: (v: string) => void;
  error?: string | false;
}) {
  return (
    <View>
      <View style={styles.labelRow}>
        <Text style={styles.labelText}>{label}</Text>
      </View>
      <View style={styles.chipWrap} accessibilityRole="radiogroup">
        {options.map(o => {
          const on = value === o.value;
          return (
            <Pressable
              key={o.value}
              onPress={() => onChange(o.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected: on }}
              style={[
                styles.chip,
                {
                  borderColor: on ? T.green : T.line,
                  backgroundColor: on ? T.greenSoft : T.field,
                },
              ]}
            >
              {on ? <Check size={16} color={T.green} /> : null}
              <Text style={[styles.chipText, { color: on ? T.greenDeep : T.inkSoft }]}>
                {o.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <FieldFoot error={error} />
    </View>
  );
}

// ─── checkbox ──────────────────────────────────────────────
export function AuthCheckbox({
  checked,
  onChange,
  error,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  error?: string | false;
  children: React.ReactNode;
}) {
  const boxBorder = error && !checked ? T.danger : checked ? T.green : T.inkMuted;
  return (
    <View>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        style={styles.checkRow}
      >
        <View
          style={[
            styles.checkBox,
            { borderColor: boxBorder, backgroundColor: checked ? T.green : 'transparent' },
          ]}
        >
          {checked ? <Check size={16} color={T.white} /> : null}
        </View>
        <Text style={styles.checkLabel}>{children}</Text>
      </Pressable>
      {error ? (
        <View style={[styles.footRow, { marginLeft: 36 }]} accessibilityRole="alert">
          <AlertCircle size={15} color={T.danger} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 7,
    marginBottom: 8,
  },
  labelText: {
    fontSize: 13.5,
    fontWeight: '700',
    color: T.ink,
  },
  optionalPill: {
    backgroundColor: T.lineSoft,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  optionalText: {
    fontSize: 11,
    fontWeight: '700',
    color: T.inkMuted,
  },
  fieldBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1.6,
    borderRadius: R.md,
    paddingHorizontal: 14,
    height: 54,
  },
  fieldFocusRing: {
    shadowColor: T.green,
    shadowOpacity: 0.18,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  input: {
    flex: 1,
    minWidth: 0,
    padding: 0,
    fontSize: 16,
    fontWeight: '600',
    color: T.ink,
    letterSpacing: -0.2,
  },
  pickerValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  footRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
  },
  errorText: {
    fontSize: 12.5,
    fontWeight: '600',
    color: T.danger,
    flex: 1,
  },
  hintText: {
    marginTop: 8,
    fontSize: 12.5,
    fontWeight: '500',
    color: T.inkMuted,
  },
  strengthRow: {
    marginTop: 9,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  strengthTrack: {
    flex: 1,
    flexDirection: 'row',
    gap: 3,
  },
  strengthBar: {
    flex: 1,
    height: 6,
    borderRadius: 999,
  },
  strengthLabel: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 54,
    textAlign: 'right',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 9,
  },
  chip: {
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: 48,
    borderWidth: 1.6,
    borderRadius: R.md,
    paddingHorizontal: 10,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  chipText: {
    fontSize: 14.5,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkBox: {
    width: 24,
    height: 24,
    marginTop: 1,
    borderRadius: R.sm,
    borderWidth: 1.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkLabel: {
    flex: 1,
    fontSize: 13.5,
    lineHeight: 20,
    fontWeight: '500',
    color: T.inkSoft,
  },
});
