import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { useProfileForm } from '../useProfileForm';
import { useAuth } from '@/context/AuthContext';

jest.mock('@/context/AuthContext', () => ({ useAuth: jest.fn() }));

const mockUseAuth = useAuth as jest.Mock;
const updateProfile = jest.fn();

function renderProfileForm() {
  const ref: { current: ReturnType<typeof useProfileForm> } = {
    current: null as any,
  };
  function Harness() {
    ref.current = useProfileForm();
    return null;
  }
  act(() => {
    ReactTestRenderer.create(<Harness />);
  });
  return ref;
}

let errSpy: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  errSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  mockUseAuth.mockReturnValue({
    user: { name: 'Ada', age: '30', gender: 'female' },
    updateProfile,
    isLoading: false,
  });
});
afterEach(() => errSpy.mockRestore());

describe('useProfileForm', () => {
  it('initializes the form from the authenticated user', () => {
    const hook = renderProfileForm();
    expect(hook.current.form).toEqual({
      name: 'Ada',
      age: '30',
      gender: 'female',
    });
    expect(hook.current.isEditing).toBe(false);
  });

  it('updateField edits a single field', () => {
    const hook = renderProfileForm();
    act(() => hook.current.updateField('name', 'Ada Lovelace'));
    expect(hook.current.form.name).toBe('Ada Lovelace');
    expect(hook.current.form.age).toBe('30');
  });

  it('handleSavePress persists the form and leaves edit mode', async () => {
    updateProfile.mockResolvedValueOnce(undefined);
    const hook = renderProfileForm();
    act(() => hook.current.handleEditPress());
    expect(hook.current.isEditing).toBe(true);

    act(() => hook.current.updateField('age', '31'));
    await act(async () => {
      await hook.current.handleSavePress();
    });

    expect(updateProfile).toHaveBeenCalledWith('Ada', '31', 'female');
    expect(hook.current.isEditing).toBe(false);
  });

  it('handleCancelPress reverts edits and leaves edit mode', () => {
    const hook = renderProfileForm();
    act(() => hook.current.handleEditPress());
    act(() => hook.current.updateField('name', 'Temp'));
    act(() => hook.current.handleCancelPress());

    expect(hook.current.form.name).toBe('Ada');
    expect(hook.current.isEditing).toBe(false);
  });

  it('keeps edit mode when the save fails', async () => {
    updateProfile.mockRejectedValueOnce(new Error('network'));
    const hook = renderProfileForm();
    act(() => hook.current.handleEditPress());
    await act(async () => {
      await hook.current.handleSavePress();
    });
    expect(hook.current.isEditing).toBe(true);
  });
});
