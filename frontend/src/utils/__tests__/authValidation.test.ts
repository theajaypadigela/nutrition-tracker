import {
  validateEmail,
  validatePassword,
  validateFullName,
  validateAge,
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
