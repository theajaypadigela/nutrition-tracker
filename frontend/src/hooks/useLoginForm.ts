import { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  validateEmail as validateEmailRule,
  validatePassword as validatePasswordRule,
} from '../utils/authValidation';

/**
 * Form controller for login: email/password values, the two blur-triggered field
 * errors and the sign-in call. Validation is eager on blur and on submit — errors
 * are not cleared as the user types, which is the existing behaviour; typing only
 * clears the top-level sign-in banner.
 */
export function useLoginForm() {
  const { login, isLoading } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [loginError, setLoginError] = useState('');

  const validateEmail = useCallback((value: string): boolean => {
    const { valid, error } = validateEmailRule(value);
    setEmailError(error);
    return valid;
  }, []);

  const validatePassword = useCallback((value: string): boolean => {
    const { valid, error } = validatePasswordRule(value);
    setPasswordError(error);
    return valid;
  }, []);

  /** Typing dismisses the sign-in banner but leaves the field error in place. */
  const changeEmail = useCallback((value: string) => {
    setEmail(value);
    setLoginError(prev => (prev ? '' : prev));
  }, []);

  const changePassword = useCallback((value: string) => {
    setPassword(value);
    setLoginError(prev => (prev ? '' : prev));
  }, []);

  const submit = useCallback(async () => {
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
  }, [email, login, password, validateEmail, validatePassword]);

  return {
    email,
    password,
    emailError,
    passwordError,
    loginError,
    isLoading,
    changeEmail,
    changePassword,
    blurEmail: useCallback(() => validateEmail(email), [email, validateEmail]),
    blurPassword: useCallback(
      () => validatePassword(password),
      [password, validatePassword],
    ),
    submit,
  };
}
