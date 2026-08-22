import { isRegistrationPasswordValid } from '../registrationPasswordPolicy';

describe('registration password policy', () => {
  it.each(['abc12345', 'nutrition9', '1234567A'])(
    'accepts a password with eight characters, a letter, and a digit',
    password => {
      expect(isRegistrationPasswordValid(password)).toBe(true);
    },
  );

  it.each(['abc123', 'abcdefgh', '12345678'])(
    'rejects a password that does not meet the registration contract',
    password => {
      expect(isRegistrationPasswordValid(password)).toBe(false);
    },
  );
});
