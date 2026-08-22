import { useCallback, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  validateDob,
  validateEmail,
  validateFullName,
  validateGender,
  validateNewPassword,
} from '../utils/authValidation';

/** Field keys the form tracks blur/submit state for. */
export type RegisterField =
  | 'name'
  | 'dob'
  | 'gender'
  | 'email'
  | 'pw'
  | 'confirm'
  | 'agree';

export interface RegisterFormValues {
  name: string;
  /** ISO yyyy-MM-dd */
  dob: string;
  gender: string;
  email: string;
  password: string;
  confirm: string;
  agree: boolean;
}

const pad = (n: number) => String(n).padStart(2, '0');
const toIsoDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/**
 * Form controller for registration: the seven field values, per-field blur/submit
 * tracking, the validation rules from utils/authValidation, the date-picker
 * open/close dance and the register call.
 *
 * On success AuthContext flips needsOnboarding + isAuthenticated, so the
 * authenticated navigator opens the call-setup flow — the screen does no navigation.
 */
export function useRegisterForm() {
  const { register, isLoading } = useAuth();

  const [values, setValues] = useState<RegisterFormValues>({
    name: '',
    dob: '',
    gender: '',
    email: '',
    password: '',
    confirm: '',
    agree: false,
  });

  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [showDob, setShowDob] = useState(false);
  const [registerError, setRegisterError] = useState('');

  const setField = useCallback(
    <K extends keyof RegisterFormValues>(
      field: K,
      value: RegisterFormValues[K],
    ) => {
      setValues(prev => ({ ...prev, [field]: value }));
    },
    [],
  );

  const touch = useCallback((field: RegisterField) => {
    setTouched(t => ({ ...t, [field]: true }));
  }, []);

  /** Whether a field's error should be visible yet (blurred, or submit attempted). */
  const showError = useCallback(
    (field: RegisterField) => touched[field] === true || submitted,
    [touched, submitted],
  );

  const { name, dob, gender, email, password, confirm, agree } = values;

  const errors = useMemo(
    () => ({
      name: validateFullName(name).error,
      dob: validateDob(dob).error,
      gender: validateGender(gender).error,
      email: validateEmail(email).error,
      pw: validateNewPassword(password).error,
      confirm: !confirm
        ? 'Please re-enter your password'
        : confirm !== password
        ? 'Passwords don’t match'
        : '',
      agree: !agree ? 'Please accept the terms to continue' : '',
    }),
    [name, dob, gender, email, password, confirm, agree],
  );

  const isValid = Object.values(errors).every(e => !e);

  /** The DateTimePicker's controlled value; falls back to 2000-01-01 when unset. */
  const dobPickerValue = dob
    ? new Date(`${dob}T00:00:00`)
    : new Date(2000, 0, 1);

  const openDobPicker = useCallback(() => {
    setShowDob(true);
    touch('dob');
  }, [touch]);

  const onDobChange = useCallback(
    (event: { type?: string }, selected?: Date) => {
      setShowDob(false);
      if (event.type === 'dismissed') return;
      if (selected) {
        setField('dob', toIsoDate(selected));
        touch('dob');
      }
    },
    [setField, touch],
  );

  const submit = useCallback(async () => {
    setSubmitted(true);
    if (!isValid) return;
    setRegisterError('');
    try {
      await register(name.trim(), email.trim(), password, dob, gender);
    } catch (error) {
      setRegisterError(
        error instanceof Error
          ? error.message
          : 'Registration failed. Please try again.',
      );
    }
  }, [dob, email, gender, isValid, name, password, register]);

  return {
    values,
    setField,
    touch,
    showError,
    errors,
    isValid,
    registerError,
    isLoading,
    showDob,
    dobPickerValue,
    openDobPicker,
    onDobChange,
    submit,
  };
}
