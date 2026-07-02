import {
  validateEmail,
  validatePassword,
  validateNewPassword,
  validateFullName,
  validateAge,
  validateDob,
  ageFromDob,
  validateGender,
} from '../authValidation';

describe('validateEmail', () => {
  it('requires a value', () => {
    expect(validateEmail('')).toEqual({ valid: false, error: 'Email is required' });
  });
  it('rejects malformed addresses', () => {
    expect(validateEmail('nope').valid).toBe(false);
    expect(validateEmail('a@b').error).toBe('Invalid email format');
    expect(validateEmail('a b@c.com').valid).toBe(false);
  });
  it('accepts a well-formed address', () => {
    expect(validateEmail('ada@x.io')).toEqual({ valid: true, error: '' });
  });
});

describe('validatePassword', () => {
  it('requires a value', () => {
    expect(validatePassword('')).toEqual({
      valid: false,
      error: 'Password is required',
    });
  });
  it('enforces the 6-char minimum', () => {
    expect(validatePassword('12345').error).toBe(
      'Password must be at least 6 characters',
    );
    expect(validatePassword('123456').valid).toBe(true);
  });
});

describe('validateNewPassword', () => {
  it('requires a value', () => {
    expect(validateNewPassword('').error).toBe('Password is required');
  });
  it('enforces the 8-char minimum', () => {
    expect(validateNewPassword('1234567').error).toBe('Use at least 8 characters');
    expect(validateNewPassword('12345678').valid).toBe(true);
  });
});

describe('ageFromDob', () => {
  it('computes whole years from an ISO date', () => {
    const d = new Date();
    const iso = `${d.getFullYear() - 30}-01-01`;
    // 30 or 29 depending on whether Jan 1 has passed — always within [29, 30].
    const age = ageFromDob(iso);
    expect(age).not.toBeNull();
    expect(age! >= 29 && age! <= 30).toBe(true);
  });
  it('returns null for unparseable input', () => {
    expect(ageFromDob('not-a-date')).toBeNull();
    expect(ageFromDob('')).toBeNull();
  });
});

describe('validateDob', () => {
  const pad = (n: number) => String(n).padStart(2, '0');
  const iso = (d: Date) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  it('requires a value', () => {
    expect(validateDob('').error).toBe('Date of birth is required');
  });
  it('rejects future dates', () => {
    const future = new Date();
    future.setFullYear(future.getFullYear() + 1);
    expect(validateDob(iso(future)).error).toBe(
      'Date of birth can’t be in the future',
    );
  });
  it('rejects under-13', () => {
    const young = new Date();
    young.setFullYear(young.getFullYear() - 10);
    expect(validateDob(iso(young)).error).toBe('You must be at least 13');
  });
  it('accepts an adult date of birth', () => {
    const adult = new Date();
    adult.setFullYear(adult.getFullYear() - 25);
    expect(validateDob(iso(adult)).valid).toBe(true);
  });
});

describe('validateFullName', () => {
  it('rejects blank / whitespace-only names', () => {
    expect(validateFullName('   ').valid).toBe(false);
  });
  it('accepts a real name', () => {
    expect(validateFullName('Ada').valid).toBe(true);
  });
});

describe('validateAge', () => {
  it('requires a value', () => {
    expect(validateAge('').error).toBe('Age is required');
  });
  it('rejects non-positive / non-numeric values', () => {
    expect(validateAge('0').error).toBe('Invalid age');
    expect(validateAge('-3').valid).toBe(false);
    expect(validateAge('abc').valid).toBe(false);
  });
  it('accepts a positive age', () => {
    expect(validateAge('30').valid).toBe(true);
  });
});

describe('validateGender', () => {
  it('requires a value', () => {
    expect(validateGender('').valid).toBe(false);
  });
  it('accepts a selection', () => {
    expect(validateGender('f').valid).toBe(true);
  });
});
