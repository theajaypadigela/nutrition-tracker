import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Mail } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AuthStackParamList } from '../../navigation/AuthNavigator';
import { useAuth } from '@/src/context/AuthContext';
import {
  BrandMark,
  Wordmark,
  Hero,
  Banner,
  AuthTextField,
  AuthPasswordField,
  PrimaryButton,
  GhostButton,
  T,
  R,
} from '../../components/auth';
import {
  validateEmail as validateEmailRule,
  validatePassword as validatePasswordRule,
} from '../../utils/authValidation';

type LoginScreenNavigationProp = NativeStackNavigationProp<
  AuthStackParamList,
  'Login'
>;

export function LoginScreen() {
  const navigation = useNavigation<LoginScreenNavigationProp>();
  const insets = useSafeAreaInsets();
  const { login, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loginError, setLoginError] = useState('');

  const validateEmail = (value: string): boolean => {
    const { valid, error } = validateEmailRule(value);
    setEmailError(error);
    return valid;
  };

  const validatePassword = (value: string): boolean => {
    const { valid, error } = validatePasswordRule(value);
    setPasswordError(error);
    return valid;
  };

  const loginUser = async () => {
    const emailOk = validateEmail(email);
    const pwOk = validatePassword(password);
    if (!emailOk || !pwOk) return;

    setLoginError('');
    try {
      await login(email, password);
    } catch (error) {
      setLoginError(
        error instanceof Error
          ? error.message
          : 'Incorrect email or password. Please try again.',
      );
    }
  };

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
          <Hero paddingTop={insets.top + 40}>
            <View style={styles.brandRow}>
              <BrandMark size={46} on="dark" />
              <Wordmark color={T.white} size={22} />
            </View>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>
              Log in to see today’s nutrition and your daily check-in call.
            </Text>
          </Hero>

          <View style={styles.sheet}>
            <View style={{ gap: 18 }}>
              {loginError ? (
                <Banner tone="error" title="Sign-in failed">
                  {loginError}
                </Banner>
              ) : null}

              <AuthTextField
                label="Email"
                icon={Mail}
                value={email}
                onChangeText={v => {
                  setEmail(v);
                  if (loginError) setLoginError('');
                }}
                onBlur={() => validateEmail(email)}
                placeholder="you@example.com"
                keyboardType="email-address"
                autoComplete="email"
                error={emailError}
              />

              <AuthPasswordField
                label="Password"
                value={password}
                onChangeText={v => {
                  setPassword(v);
                  if (loginError) setLoginError('');
                }}
                onBlur={() => validatePassword(password)}
                placeholder="Enter your password"
                autoComplete="password"
                error={passwordError}
              />

              <PrimaryButton onPress={loginUser} loading={isLoading}>
                {isLoading ? 'Signing in…' : 'Log in'}
              </PrimaryButton>
            </View>

            <View style={styles.createBlock}>
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>New to Nourish?</Text>
                <View style={styles.dividerLine} />
              </View>
              <GhostButton onPress={() => navigation.navigate('Register')}>
                Create an account
              </GhostButton>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: T.greenMid },
  flex: { flex: 1 },
  scroll: { flexGrow: 1, backgroundColor: T.bg },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  title: {
    color: T.white,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -1,
    marginTop: 26,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
    marginTop: 10,
    maxWidth: 300,
  },
  sheet: {
    flex: 1,
    marginTop: -46,
    backgroundColor: T.surface,
    borderTopLeftRadius: R.xl,
    borderTopRightRadius: R.xl,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 30,
  },
  createBlock: { marginTop: 26 },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 18,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: T.line },
  dividerText: {
    fontSize: 12,
    fontWeight: '700',
    color: T.inkMuted,
    letterSpacing: 0.4,
  },
});
