import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useLoginForm } from '../useLoginForm';
import { useAuth } from '@/context/AuthContext';

jest.mock('@/context/AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const login = jest.fn();

/** The exact copy LoginScreen renders when login() throws a non-Error. */
const FALLBACK = 'Incorrect email or password. Please try again.';
const EMAIL = 'ada@x.io';
const PASSWORD = 'secret123';

interface Harnessed {
  ref: { current: ReturnType<typeof useLoginForm> };
  /** loginError as seen on every render, in order — used to prove it never thrashes. */
  loginErrors: string[];
}

function renderLoginForm(): Harnessed {
  const ref: { current: ReturnType<typeof useLoginForm> } = {
    current: null as any,
  };
  const loginErrors: string[] = [];
  function Harness() {
    ref.current = useLoginForm();
    loginErrors.push(ref.current.loginError);
    return null;
  }
  act(() => {
    ReactTestRenderer.create(<Harness />);
  });
  return { ref, loginErrors };
}

/** Types both fields. Separate acts so the next call sees a fresh memoized callback. */
function typeCredentials(
  ref: Harnessed['ref'],
  email: string,
  password: string,
) {
  act(() => {
    ref.current.changeEmail(email);
  });
  act(() => {
    ref.current.changePassword(password);
  });
}

async function submit(ref: Harnessed['ref']) {
  await act(async () => {
    await ref.current.submit();
  });
}

let errSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockUseAuth.mockReturnValue({ login, isLoading: false });
});
afterEach(() => errSpy.mockRestore());

describe('useLoginForm', () => {
  it('starts empty with no errors', () => {
    const { ref } = renderLoginForm();
    expect(ref.current.email).toBe('');
    expect(ref.current.password).toBe('');
    expect(ref.current.emailError).toBe('');
    expect(ref.current.passwordError).toBe('');
    expect(ref.current.loginError).toBe('');
  });

  it('changeEmail / changePassword hold the typed values', () => {
    const { ref } = renderLoginForm();
    typeCredentials(ref, EMAIL, PASSWORD);
    expect(ref.current.email).toBe(EMAIL);
    expect(ref.current.password).toBe(PASSWORD);
  });

  describe('submit validation', () => {
    it('blocks submit and reports both required-field messages when empty', async () => {
      const { ref } = renderLoginForm();
      await submit(ref);

      expect(login).not.toHaveBeenCalled();
      expect(ref.current.emailError).toBe('Email is required');
      expect(ref.current.passwordError).toBe('Password is required');
      expect(ref.current.loginError).toBe('');
    });

    it('validates the password even when the email is already invalid', async () => {
      // Pins that submit does not short-circuit: both validators run before the bail-out.
      const { ref } = renderLoginForm();
      typeCredentials(ref, 'not-an-email', '');
      await submit(ref);

      expect(login).not.toHaveBeenCalled();
      expect(ref.current.emailError).toBe('Invalid email format');
      expect(ref.current.passwordError).toBe('Password is required');
    });

    it('blocks submit on a short password and leaves the email clean', async () => {
      const { ref } = renderLoginForm();
      typeCredentials(ref, EMAIL, '12345');
      await submit(ref);

      expect(login).not.toHaveBeenCalled();
      expect(ref.current.emailError).toBe('');
      expect(ref.current.passwordError).toBe(
        'Password must be at least 6 characters',
      );
    });

    it('accepts a 6-character password (login keeps the lenient rule)', async () => {
      const { ref } = renderLoginForm();
      typeCredentials(ref, EMAIL, '123456');
      await submit(ref);

      expect(login).toHaveBeenCalledWith(EMAIL, '123456');
      expect(ref.current.passwordError).toBe('');
    });
  });

  describe('submit success', () => {
    it('calls login(email, password) exactly once and clears the errors', async () => {
      login.mockResolvedValueOnce(undefined);
      const { ref } = renderLoginForm();
      typeCredentials(ref, EMAIL, PASSWORD);
      await submit(ref);

      expect(login).toHaveBeenCalledTimes(1);
      expect(login).toHaveBeenCalledWith(EMAIL, PASSWORD);
      expect(ref.current.emailError).toBe('');
      expect(ref.current.passwordError).toBe('');
      expect(ref.current.loginError).toBe('');
    });

    it('clears a stale loginError when a retry succeeds', async () => {
      login.mockRejectedValueOnce(new Error('Server unavailable'));
      const { ref } = renderLoginForm();
      typeCredentials(ref, EMAIL, PASSWORD);
      await submit(ref);
      expect(ref.current.loginError).toBe('Server unavailable');

      // Retry with the same (still valid) credentials — no typing in between.
      login.mockResolvedValueOnce(undefined);
      await submit(ref);

      expect(login).toHaveBeenCalledTimes(2);
      expect(ref.current.loginError).toBe('');
    });
  });

  describe('submit failure', () => {
    it('surfaces error.message when login rejects with an Error', async () => {
      login.mockRejectedValueOnce(new Error('Account locked'));
      const { ref } = renderLoginForm();
      typeCredentials(ref, EMAIL, PASSWORD);
      await submit(ref);

      expect(ref.current.loginError).toBe('Account locked');
    });

    it('falls back to the canned copy when login rejects with a string', async () => {
      login.mockImplementationOnce(() => Promise.reject('401'));
      const { ref } = renderLoginForm();
      typeCredentials(ref, EMAIL, PASSWORD);
      await submit(ref);

      expect(ref.current.loginError).toBe(FALLBACK);
    });

    it('falls back to the canned copy when login rejects with a plain object', async () => {
      // A shape with a .message that is NOT an Error must still take the fallback branch.
      login.mockImplementationOnce(() =>
        Promise.reject({ message: 'raw axios payload', status: 401 }),
      );
      const { ref } = renderLoginForm();
      typeCredentials(ref, EMAIL, PASSWORD);
      await submit(ref);

      expect(ref.current.loginError).toBe(FALLBACK);
    });

    it('leaves the field errors clean when the credentials were well-formed', async () => {
      login.mockRejectedValueOnce(new Error('Account locked'));
      const { ref } = renderLoginForm();
      typeCredentials(ref, EMAIL, PASSWORD);
      await submit(ref);

      expect(ref.current.emailError).toBe('');
      expect(ref.current.passwordError).toBe('');
    });
  });

  describe('the typing asymmetry (documented in the hook)', () => {
    it('changeEmail clears the top-level loginError', async () => {
      login.mockRejectedValueOnce(new Error('Account locked'));
      const { ref } = renderLoginForm();
      typeCredentials(ref, EMAIL, PASSWORD);
      await submit(ref);
      expect(ref.current.loginError).toBe('Account locked');

      act(() => {
        ref.current.changeEmail('ada@y.io');
      });
      expect(ref.current.loginError).toBe('');
    });

    it('changePassword clears the top-level loginError', async () => {
      login.mockRejectedValueOnce(new Error('Account locked'));
      const { ref } = renderLoginForm();
      typeCredentials(ref, EMAIL, PASSWORD);
      await submit(ref);
      expect(ref.current.loginError).toBe('Account locked');

      act(() => {
        ref.current.changePassword('anotherpw');
      });
      expect(ref.current.loginError).toBe('');
    });

    it('changeEmail LEAVES the email field error in place', async () => {
      const { ref } = renderLoginForm();
      typeCredentials(ref, 'not-an-email', PASSWORD);
      await submit(ref);
      expect(ref.current.emailError).toBe('Invalid email format');

      // Typing a perfectly valid address does not re-validate — the error persists
      // until the next blur or submit. This is the existing behaviour.
      act(() => {
        ref.current.changeEmail(EMAIL);
      });
      expect(ref.current.email).toBe(EMAIL);
      expect(ref.current.emailError).toBe('Invalid email format');
    });

    it('changePassword LEAVES the password field error in place', async () => {
      const { ref } = renderLoginForm();
      typeCredentials(ref, EMAIL, '123');
      await submit(ref);
      expect(ref.current.passwordError).toBe(
        'Password must be at least 6 characters',
      );

      act(() => {
        ref.current.changePassword(PASSWORD);
      });
      expect(ref.current.password).toBe(PASSWORD);
      expect(ref.current.passwordError).toBe(
        'Password must be at least 6 characters',
      );
    });

    it('does not thrash loginError when it is already empty', () => {
      const { ref, loginErrors } = renderLoginForm();
      const from = loginErrors.length;

      act(() => {
        ref.current.changeEmail('a');
      });
      act(() => {
        ref.current.changeEmail('ab');
      });
      act(() => {
        ref.current.changePassword('p');
      });

      // Every render produced by typing saw the same empty banner.
      expect(loginErrors.slice(from)).not.toHaveLength(0);
      expect(loginErrors.slice(from).every(v => v === '')).toBe(true);
      expect(ref.current.loginError).toBe('');
    });
  });

  describe('blur', () => {
    it('blurEmail validates the current value and returns false with a message', () => {
      const { ref } = renderLoginForm();
      typeCredentials(ref, 'nope', PASSWORD);

      let result = true;
      act(() => {
        result = ref.current.blurEmail();
      });
      expect(result).toBe(false);
      expect(ref.current.emailError).toBe('Invalid email format');
    });

    it('blurEmail returns true and clears a stale message once the value is fixed', () => {
      const { ref } = renderLoginForm();
      typeCredentials(ref, 'nope', PASSWORD);
      act(() => {
        ref.current.blurEmail();
      });
      expect(ref.current.emailError).toBe('Invalid email format');

      act(() => {
        ref.current.changeEmail(EMAIL);
      });
      let result = false;
      act(() => {
        result = ref.current.blurEmail();
      });
      expect(result).toBe(true);
      expect(ref.current.emailError).toBe('');
    });

    it('blurEmail on an untouched field reports the required message', () => {
      const { ref } = renderLoginForm();
      let result = true;
      act(() => {
        result = ref.current.blurEmail();
      });
      expect(result).toBe(false);
      expect(ref.current.emailError).toBe('Email is required');
    });

    it('blurPassword validates the current value and returns the boolean', () => {
      const { ref } = renderLoginForm();
      typeCredentials(ref, EMAIL, '12345');

      let result = true;
      act(() => {
        result = ref.current.blurPassword();
      });
      expect(result).toBe(false);
      expect(ref.current.passwordError).toBe(
        'Password must be at least 6 characters',
      );

      act(() => {
        ref.current.changePassword(PASSWORD);
      });
      act(() => {
        result = ref.current.blurPassword();
      });
      expect(result).toBe(true);
      expect(ref.current.passwordError).toBe('');
    });

    it('blurring never calls login', () => {
      const { ref } = renderLoginForm();
      typeCredentials(ref, EMAIL, PASSWORD);
      act(() => {
        ref.current.blurEmail();
      });
      act(() => {
        ref.current.blurPassword();
      });
      expect(login).not.toHaveBeenCalled();
    });
  });

  describe('isLoading', () => {
    it('passes AuthContext.isLoading straight through when true', () => {
      mockUseAuth.mockReturnValue({ login, isLoading: true });
      const { ref } = renderLoginForm();
      expect(ref.current.isLoading).toBe(true);
    });

    it('passes AuthContext.isLoading straight through when false', () => {
      mockUseAuth.mockReturnValue({ login, isLoading: false });
      const { ref } = renderLoginForm();
      expect(ref.current.isLoading).toBe(false);
    });
  });

  it('calls the login from AuthContext, not a captured stale one', async () => {
    // Re-pointing useAuth at a different login must change who submit() calls.
    const otherLogin = jest.fn().mockResolvedValue(undefined);
    mockUseAuth.mockReturnValue({ login: otherLogin, isLoading: false });
    const { ref } = renderLoginForm();
    typeCredentials(ref, EMAIL, PASSWORD);
    await submit(ref);

    expect(otherLogin).toHaveBeenCalledWith(EMAIL, PASSWORD);
    expect(login).not.toHaveBeenCalled();
  });
});
