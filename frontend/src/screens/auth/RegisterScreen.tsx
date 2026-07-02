import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ArrowLeft, Calendar, Mail, User } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useAuth } from '@/src/context/AuthContext';
import {
  BrandMark,
  Hero,
  Banner,
  AuthTextField,
  AuthPasswordField,
  PickerField,
  GenderChips,
  AuthCheckbox,
  PrimaryButton,
  TextLink,
  T,
  R,
  formatDob,
} from '../../components/auth';
import {
  validateEmail as validateEmailRule,
  validateNewPassword as validatePasswordRule,
  validateFullName as validateFullNameRule,
  validateDob as validateDobRule,
  validateGender as validateGenderRule,
} from '../../utils/authValidation';

type RegisterScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Register'
>;

const GENDER_OPTIONS = [
  { label: 'Female', value: 'female' },
  { label: 'Male', value: 'male' },
  { label: 'Non-binary', value: 'non_binary' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export default function RegisterScreen() {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const { register, isLoading } = useAuth();

  const [name, setName] = useState('');
  const [dob, setDob] = useState(''); // ISO yyyy-MM-dd
  const [gender, setGender] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agree, setAgree] = useState(false);

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showDob, setShowDob] = useState(false);
  const [registerError, setRegisterError] = useState('');

  const touch = (k: string) => setTouched(t => ({ ...t, [k]: true }));
  const show = (k: string) => touched[k] || submitted;

  const errs = useMemo(
    () => ({
      name: validateFullNameRule(name).error,
      dob: validateDobRule(dob).error,
      gender: validateGenderRule(gender).error,
      email: validateEmailRule(email).error,
      pw: validatePasswordRule(password).error,
      confirm: !confirm
        ? 'Please re-enter your password'
        : confirm !== password
        ? 'Passwords don’t match'
        : '',
      agree: !agree ? 'Please accept the terms to continue' : '',
    }),
    [name, dob, gender, email, password, confirm, agree],
  );

  const isValid = Object.values(errs).every(e => !e);

  const onDateChange = (event: { type?: string }, selected?: Date) => {
    setShowDob(false);
    if (event.type === 'dismissed') return;
    if (selected) {
      setDob(toIsoDate(selected));
      touch('dob');
    }
  };

  const handleRegister = async () => {
    setSubmitted(true);
    if (!isValid) return;
    setRegisterError('');
    try {
      await register(name.trim(), email.trim(), password, dob, gender);
      // On success AuthContext flips needsOnboarding + isAuthenticated, so the
      // authenticated navigator opens the call-setup flow — no manual navigation.
    } catch (error) {
      setRegisterError(
        error instanceof Error
          ? error.message
          : 'Registration failed. Please try again.',
      );
    }
  };

  const dobPickerValue = dob ? new Date(`${dob}T00:00:00`) : new Date(2000, 0, 1);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" backgroundColor={T.greenMid} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Hero paddingTop={insets.top + 18}>
            <View style={styles.brandRow}>
              <Pressable
                onPress={() => navigation.goBack()}
                accessibilityRole="button"
                accessibilityLabel="Back to login"
                style={styles.backBtn}
              >
                <ArrowLeft size={20} color={T.white} />
              </Pressable>
              <BrandMark size={38} on="dark" />
            </View>
            <Text style={styles.title}>Create your account</Text>
            <Text style={styles.subtitle}>
              Start tracking your nutrition through a simple daily call.
            </Text>
          </Hero>

          <View style={styles.sheet}>
            <View style={styles.fields}>
              <AuthTextField
                label="Full name"
                icon={User}
                value={name}
                onChangeText={setName}
                onBlur={() => touch('name')}
                placeholder="e.g. Alex Morgan"
                autoCapitalize="words"
                autoComplete="name"
                error={show('name') && errs.name}
              />

              <PickerField
                label="Date of birth"
                icon={Calendar}
                value={formatDob(dob)}
                placeholder="Select your date of birth"
                active={showDob}
                onPress={() => {
                  setShowDob(true);
                  touch('dob');
                }}
                error={show('dob') && errs.dob}
              />

              <GenderChips
                label="Gender"
                options={GENDER_OPTIONS}
                value={gender}
                onChange={v => {
                  setGender(v);
                  touch('gender');
                }}
                error={show('gender') && errs.gender}
              />

              <AuthTextField
                label="Email"
                icon={Mail}
                value={email}
                onChangeText={setEmail}
                onBlur={() => touch('email')}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoComplete="email"
                error={show('email') && errs.email}
              />

              <AuthPasswordField
                label="Password"
                value={password}
                onChangeText={setPassword}
                onBlur={() => touch('pw')}
                placeholder="Create a password"
                autoComplete="password-new"
                strength
                error={show('pw') && errs.pw}
                hint={!password ? 'At least 8 characters.' : undefined}
              />

              <AuthPasswordField
                label="Confirm password"
                value={confirm}
                onChangeText={setConfirm}
                onBlur={() => touch('confirm')}
                placeholder="Re-enter your password"
                autoComplete="password-new"
                error={show('confirm') && errs.confirm}
              />

              <AuthCheckbox
                checked={agree}
                onChange={v => {
                  setAgree(v);
                  touch('agree');
                }}
                error={show('agree') && errs.agree}
              >
                I agree to Nourish’s{' '}
                <Text style={styles.terms}>Terms of Service</Text> and{' '}
                <Text style={styles.terms}>Privacy Policy</Text>.
              </AuthCheckbox>

              {registerError ? (
                <Banner tone="error" title="Couldn’t create account">
                  {registerError}
                </Banner>
              ) : null}
            </View>
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <PrimaryButton onPress={handleRegister} loading={isLoading}>
            {isLoading ? 'Creating account…' : 'Create account'}
          </PrimaryButton>
          <View style={styles.footerLinkRow}>
            <Text style={styles.footerText}>Already have an account? </Text>
            <TextLink onPress={() => navigation.navigate('Login')}>Log in</TextLink>
          </View>
        </View>
      </KeyboardAvoidingView>

      {showDob ? (
        <DateTimePicker
          value={dobPickerValue}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={onDateChange}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.greenMid },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, backgroundColor: T.surface },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    color: T.white,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.9,
    marginTop: 20,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 14.5,
    fontWeight: '500',
    lineHeight: 21,
    marginTop: 8,
    maxWidth: 300,
  },
  sheet: {
    flex: 1,
    marginTop: -44,
    backgroundColor: T.surface,
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
  },
  fields: {
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 24,
    gap: 18,
  },
  terms: { color: T.green, fontWeight: '700' },
  footer: {
    backgroundColor: T.surface,
    borderTopWidth: 1,
    borderTopColor: T.lineSoft,
    paddingHorizontal: 22,
    paddingTop: 14,
  },
  footerLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 13,
  },
  footerText: { fontSize: 13.5, fontWeight: '600', color: T.inkSoft },
});
