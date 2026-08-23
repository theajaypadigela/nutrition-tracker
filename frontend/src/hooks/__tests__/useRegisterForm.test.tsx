import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useRegisterForm, RegisterField } from '../useRegisterForm';
import { useAuth } from '@/context/AuthContext';

// Only the auth boundary is mocked. utils/authValidation stays real: its messages are
// the contract RegisterScreen renders verbatim, so the rules are part of what we pin.
jest.mock('@/context/AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const register = jest.fn();

type RegisterForm = ReturnType<typeof useRegisterForm>;
type HookRef = { current: RegisterForm };

function renderRegisterForm(isLoading = false): HookRef {
  mockUseAuth.mockReturnValue({ register, isLoading });
  const ref: HookRef = { current: null as unknown as RegisterForm };
  function Harness() {
    ref.current = useRegisterForm();
    return null;
  }
  act(() => {
    ReactTestRenderer.create(<Harness />);
  });
  return ref;
}

const ALL_FIELDS: RegisterField[] = [
  'name',
  'dob',
  'gender',
  'email',
  'pw',
  'confirm',
  'agree',
];

// A set of values every validator accepts. The padding is deliberate: validateFullName
// trims, validateNewPassword only measures length and validateGender only checks for a
// non-empty string, so these stay valid while proving which values submit() trims.
const VALID = {
  name: '  Ada Lovelace  ',
  dob: '1995-05-07',
  gender: ' female ',
  email: 'ada@x.io',
  password: ' sup3rsecret ',
  confirm: ' sup3rsecret ',
};

function fillValid(hook: HookRef) {
  act(() => {
    hook.current.setField('name', VALID.name);
    hook.current.setField('dob', VALID.dob);
    hook.current.setField('gender', VALID.gender);
    hook.current.setField('email', VALID.email);
    hook.current.setField('password', VALID.password);
    hook.current.setField('confirm', VALID.confirm);
    hook.current.setField('agree', true);
  });
}

let errSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  register.mockResolvedValue(undefined);
});
afterEach(() => errSpy.mockRestore());

describe('useRegisterForm', () => {
  describe('errors / isValid', () => {
    it('derives an error for every one of the seven fields on a pristine form', () => {
      const hook = renderRegisterForm();
      expect(hook.current.errors).toEqual({
        name: 'Full name is required',
        dob: 'Date of birth is required',
        gender: 'Gender is required',
        email: 'Email is required',
        pw: 'Password is required',
        confirm: 'Please re-enter your password',
        agree: 'Please accept the terms to continue',
      });
      expect(hook.current.isValid).toBe(false);
    });

    it('clears every error and turns valid once all seven values pass', () => {
      const hook = renderRegisterForm();
      fillValid(hook);
      expect(hook.current.errors).toEqual({
        name: '',
        dob: '',
        gender: '',
        email: '',
        pw: '',
        confirm: '',
        agree: '',
      });
      expect(hook.current.isValid).toBe(true);
    });

    // One bad field is enough to hold isValid false — and it must be *that* field's
    // error that appears, so the errors map stays wired field-by-field.
    const breakers: Array<{
      label: string;
      apply: (h: RegisterForm) => void;
      key: keyof RegisterForm['errors'];
      message: string;
    }> = [
      {
        label: 'a whitespace-only name',
        apply: h => h.setField('name', '   '),
        key: 'name',
        message: 'Full name is required',
      },
      {
        label: 'an unset date of birth',
        apply: h => h.setField('dob', ''),
        key: 'dob',
        message: 'Date of birth is required',
      },
      {
        label: 'a date of birth under 13',
        apply: h => h.setField('dob', `${new Date().getFullYear() - 5}-01-01`),
        key: 'dob',
        message: 'You must be at least 13',
      },
      {
        label: 'no gender',
        apply: h => h.setField('gender', ''),
        key: 'gender',
        message: 'Gender is required',
      },
      {
        label: 'a malformed email',
        apply: h => h.setField('email', 'ada@x'),
        key: 'email',
        message: 'Invalid email format',
      },
      {
        label: 'a 7-character password',
        apply: h => h.setField('password', 'sup3rse'),
        key: 'pw',
        message: 'Use at least 8 characters',
      },
      {
        label: 'a mismatched confirmation',
        apply: h => h.setField('confirm', 'sup3rsecretX'),
        key: 'confirm',
        message: 'Passwords don’t match',
      },
      {
        label: 'the terms unaccepted',
        apply: h => h.setField('agree', false),
        key: 'agree',
        message: 'Please accept the terms to continue',
      },
    ];

    breakers.forEach(({ label, apply, key, message }) => {
      it(`stays invalid with ${label}`, () => {
        const hook = renderRegisterForm();
        fillValid(hook);
        act(() => apply(hook.current));
        expect(hook.current.errors[key]).toBe(message);
        expect(hook.current.isValid).toBe(false);
      });
    });

    // The email validator runs on the raw value, so a padded address never validates
    // even though submit() would have trimmed it.
    it('rejects a padded email because the rule runs before the trim', () => {
      const hook = renderRegisterForm();
      fillValid(hook);
      act(() => hook.current.setField('email', '  ada@x.io  '));
      expect(hook.current.errors.email).toBe('Invalid email format');
      expect(hook.current.isValid).toBe(false);
    });
  });

  describe('the confirm-password branch', () => {
    it('asks for a re-entry while confirm is empty, even when the password is too', () => {
      const hook = renderRegisterForm();
      expect(hook.current.errors.confirm).toBe('Please re-enter your password');
      act(() => hook.current.setField('password', 'sup3rsecret'));
      expect(hook.current.errors.confirm).toBe('Please re-enter your password');
    });

    it('reports a mismatch when confirm differs from the password', () => {
      const hook = renderRegisterForm();
      act(() => {
        hook.current.setField('password', 'sup3rsecret');
        hook.current.setField('confirm', 'sup3rsecrey');
      });
      expect(hook.current.errors.confirm).toBe('Passwords don’t match');
    });

    it('is satisfied by an exact match (comparison is untrimmed)', () => {
      const hook = renderRegisterForm();
      act(() => {
        hook.current.setField('password', ' sup3rsecret ');
        hook.current.setField('confirm', 'sup3rsecret');
      });
      expect(hook.current.errors.confirm).toBe('Passwords don’t match');
      act(() => hook.current.setField('confirm', ' sup3rsecret '));
      expect(hook.current.errors.confirm).toBe('');
    });
  });

  describe('showError', () => {
    it('hides every field error until the field is touched', () => {
      const hook = renderRegisterForm();
      ALL_FIELDS.forEach(field =>
        expect(hook.current.showError(field)).toBe(false),
      );

      act(() => hook.current.touch('email'));
      expect(hook.current.showError('email')).toBe(true);
      ALL_FIELDS.filter(f => f !== 'email').forEach(field =>
        expect(hook.current.showError(field)).toBe(false),
      );
    });

    it('reveals EVERY field error after a failed submit, not just touched ones', async () => {
      const hook = renderRegisterForm();
      await act(async () => {
        await hook.current.submit();
      });
      ALL_FIELDS.forEach(field =>
        expect(hook.current.showError(field)).toBe(true),
      );
    });

    it('keeps errors revealed after a submit even for fields fixed afterwards', async () => {
      const hook = renderRegisterForm();
      await act(async () => {
        await hook.current.submit();
      });
      fillValid(hook);
      expect(hook.current.showError('name')).toBe(true);
    });
  });

  describe('submit', () => {
    it('does not call register when the form is invalid, but does flip submitted', async () => {
      const hook = renderRegisterForm();
      act(() => {
        hook.current.setField('name', 'Ada');
        hook.current.setField('email', 'ada@x.io');
      });
      await act(async () => {
        await hook.current.submit();
      });
      expect(register).not.toHaveBeenCalled();
      expect(hook.current.showError('dob')).toBe(true);
      expect(hook.current.registerError).toBe('');
    });

    it('calls register with a trimmed name and email but a raw password, dob and gender', async () => {
      const hook = renderRegisterForm();
      fillValid(hook);
      await act(async () => {
        await hook.current.submit();
      });
      expect(register).toHaveBeenCalledTimes(1);
      expect(register).toHaveBeenCalledWith(
        'Ada Lovelace',
        'ada@x.io',
        ' sup3rsecret ',
        '1995-05-07',
        ' female ',
      );
      expect(hook.current.registerError).toBe('');
    });

    it('surfaces the message of an Error thrown by register', async () => {
      register.mockRejectedValueOnce(new Error('Email already registered'));
      const hook = renderRegisterForm();
      fillValid(hook);
      await act(async () => {
        await hook.current.submit();
      });
      expect(hook.current.registerError).toBe('Email already registered');
    });

    it('falls back to a generic message for a non-Error rejection', async () => {
      register.mockRejectedValueOnce('socket hang up');
      const hook = renderRegisterForm();
      fillValid(hook);
      await act(async () => {
        await hook.current.submit();
      });
      expect(hook.current.registerError).toBe(
        'Registration failed. Please try again.',
      );
    });

    it('clears a previous registerError when a retry succeeds', async () => {
      register.mockRejectedValueOnce(new Error('server down'));
      const hook = renderRegisterForm();
      fillValid(hook);
      await act(async () => {
        await hook.current.submit();
      });
      expect(hook.current.registerError).toBe('server down');

      await act(async () => {
        await hook.current.submit();
      });
      expect(register).toHaveBeenCalledTimes(2);
      expect(hook.current.registerError).toBe('');
    });
  });

  describe('the date picker', () => {
    it('openDobPicker opens the picker and touches dob', () => {
      const hook = renderRegisterForm();
      expect(hook.current.showDob).toBe(false);
      act(() => hook.current.openDobPicker());
      expect(hook.current.showDob).toBe(true);
      expect(hook.current.showError('dob')).toBe(true);
      expect(hook.current.values.dob).toBe('');
    });

    it('a dismissed change closes the picker and leaves dob alone', () => {
      const hook = renderRegisterForm();
      act(() => hook.current.setField('dob', '1990-03-04'));
      act(() => hook.current.openDobPicker());
      act(() => hook.current.onDobChange({ type: 'dismissed' }, new Date(1995, 4, 7)));
      expect(hook.current.showDob).toBe(false);
      expect(hook.current.values.dob).toBe('1990-03-04');
    });

    it('a selected date is stored as a local yyyy-MM-dd string and touches dob', () => {
      const hook = renderRegisterForm();
      act(() => hook.current.openDobPicker());
      act(() => hook.current.onDobChange({ type: 'set' }, new Date(1995, 4, 7)));
      expect(hook.current.values.dob).toBe('1995-05-07');
      expect(hook.current.showDob).toBe(false);
      expect(hook.current.showError('dob')).toBe(true);
    });

    it('zero-pads single-digit months and days', () => {
      const hook = renderRegisterForm();
      act(() => hook.current.onDobChange({ type: 'set' }, new Date(2001, 0, 3)));
      expect(hook.current.values.dob).toBe('2001-01-03');
    });

    it('a change with no date closes the picker without setting dob', () => {
      const hook = renderRegisterForm();
      act(() => hook.current.openDobPicker());
      act(() => hook.current.onDobChange({ type: 'set' }));
      expect(hook.current.showDob).toBe(false);
      expect(hook.current.values.dob).toBe('');
    });

    it('dobPickerValue falls back to 2000-01-01 while dob is unset', () => {
      const hook = renderRegisterForm();
      const d = hook.current.dobPickerValue;
      expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([2000, 0, 1]);
    });

    it('dobPickerValue tracks dob as a local midnight date', () => {
      const hook = renderRegisterForm();
      act(() => hook.current.setField('dob', '1995-05-07'));
      const d = hook.current.dobPickerValue;
      expect([d.getFullYear(), d.getMonth(), d.getDate()]).toEqual([1995, 4, 7]);
      expect(d.getHours()).toBe(0);
    });
  });

  it('passes AuthContext.isLoading straight through', () => {
    expect(renderRegisterForm(true).current.isLoading).toBe(true);
    expect(renderRegisterForm(false).current.isLoading).toBe(false);
  });
});
