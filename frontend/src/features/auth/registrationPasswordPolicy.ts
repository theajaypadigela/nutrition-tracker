const REGISTRATION_PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d).{8,}$/;

export const REGISTRATION_PASSWORD_REQUIREMENT =
  'Password must be at least 8 characters and include a letter and number';

export const isRegistrationPasswordValid = (password: string): boolean =>
  REGISTRATION_PASSWORD_PATTERN.test(password);
