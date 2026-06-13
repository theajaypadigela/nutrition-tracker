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
