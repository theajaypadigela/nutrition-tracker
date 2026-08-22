import React from 'react';
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
import { useRegisterForm } from '../../hooks/useRegisterForm';

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

export default function RegisterScreen() {
  const navigation = useNavigation<RegisterScreenNavigationProp>();
  const insets = useSafeAreaInsets();

  const {
    values,
    setField,
    touch,
    showError,
    errors,
    registerError,
    isLoading,
    showDob,
    dobPickerValue,
    openDobPicker,
    onDobChange,
    submit,
  } = useRegisterForm();

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
                value={values.name}
                onChangeText={v => setField('name', v)}
                onBlur={() => touch('name')}
                placeholder="e.g. Alex Morgan"
                autoCapitalize="words"
                autoComplete="name"
                error={showError('name') && errors.name}
              />

              <PickerField
                label="Date of birth"
                icon={Calendar}
                value={formatDob(values.dob)}
                placeholder="Select your date of birth"
                active={showDob}
                onPress={openDobPicker}
                error={showError('dob') && errors.dob}
              />

              <GenderChips
                label="Gender"
                options={GENDER_OPTIONS}
                value={values.gender}
                onChange={v => {
                  setField('gender', v);
                  touch('gender');
                }}
                error={showError('gender') && errors.gender}
              />

              <AuthTextField
                label="Email"
                icon={Mail}
                value={values.email}
                onChangeText={v => setField('email', v)}
                onBlur={() => touch('email')}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoComplete="email"
                error={showError('email') && errors.email}
              />

              <AuthPasswordField
                label="Password"
                value={values.password}
                onChangeText={v => setField('password', v)}
                onBlur={() => touch('pw')}
                placeholder="Create a password"
                autoComplete="password-new"
                strength
                error={showError('pw') && errors.pw}
                hint={!values.password ? 'At least 8 characters.' : undefined}
              />

              <AuthPasswordField
                label="Confirm password"
                value={values.confirm}
                onChangeText={v => setField('confirm', v)}
                onBlur={() => touch('confirm')}
                placeholder="Re-enter your password"
                autoComplete="password-new"
                error={showError('confirm') && errors.confirm}
              />

              <AuthCheckbox
                checked={values.agree}
                onChange={v => {
                  setField('agree', v);
                  touch('agree');
                }}
                error={showError('agree') && errors.agree}
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
          <PrimaryButton onPress={submit} loading={isLoading}>
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
          onChange={onDobChange}
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
