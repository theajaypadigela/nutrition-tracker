/**
 * Pure auth-form validators shared by LoginScreen and RegisterScreen. Each returns the
 * validation outcome plus the exact error message the screens display; the screens own the
 * error state and call setX(error). Keeping these pure makes them unit-testable and keeps a
 * single source of truth for the rules (previously duplicated across both screens).
 */
export interface ValidationResult {
  valid: boolean;
  error: string;
}

const ok: ValidationResult = { valid: true, error: '' };

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEmail(email: string): ValidationResult {
  if (!email) return { valid: false, error: 'Email is required' };
  if (!EMAIL_REGEX.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }
  return ok;
}

export function validatePassword(password: string): ValidationResult {
  if (!password) return { valid: false, error: 'Password is required' };
  if (password.length < 6) {
    return { valid: false, error: 'Password must be at least 6 characters' };
  }
  return ok;
}

/**
 * Stricter rule for newly-created passwords (registration). Login keeps the lenient
 * {@link validatePassword} (≥6) so accounts created before this rule can still sign in.
 */
export function validateNewPassword(password: string): ValidationResult {
  if (!password) return { valid: false, error: 'Password is required' };
  if (password.length < 8) {
    return { valid: false, error: 'Use at least 8 characters' };
  }
  return ok;
}

/** Whole years from an ISO `yyyy-MM-dd` date of birth, or null if unparseable. */
export function ageFromDob(iso: string): number | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - d.getFullYear();
  const monthDiff = today.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < d.getDate())) {
    age--;
  }
  return age;
}

/** Date of birth: required, a real past date, and at least 13 years old. */
export function validateDob(iso: string): ValidationResult {
  if (!iso) return { valid: false, error: 'Date of birth is required' };
  const d = new Date(`${iso}T00:00:00`);
  if (isNaN(d.getTime())) {
    return { valid: false, error: 'Enter a valid date' };
  }
  if (d.getTime() > Date.now()) {
    return { valid: false, error: 'Date of birth can’t be in the future' };
  }
  const age = ageFromDob(iso);
  if (age !== null && age < 13) {
    return { valid: false, error: 'You must be at least 13' };
  }
  return ok;
}

export function validateFullName(name: string): ValidationResult {
  if (!name.trim()) return { valid: false, error: 'Full name is required' };
  return ok;
}

export function validateAge(age: string): ValidationResult {
  if (!age) return { valid: false, error: 'Age is required' };
  if (isNaN(Number(age)) || Number(age) <= 0) {
    return { valid: false, error: 'Invalid age' };
  }
  return ok;
}

export function validateGender(gender: string): ValidationResult {
  if (!gender) return { valid: false, error: 'Gender is required' };
  return ok;
}
