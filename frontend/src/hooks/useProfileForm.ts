import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export interface ProfileFormFields {
  name: string;
  age: string;
  gender: string;
}

/**
 * Form controller for the profile editor: keeps an editable copy of the authenticated
 * user's fields, syncs when the user changes, and saves via AuthContext.updateProfile.
 * ProfileScreen renders from this and stays presentation-only.
 */
export function useProfileForm() {
  const { user, updateProfile, isLoading } = useAuth();
  const name = user?.name;
  const age = user?.age;
  const gender = user?.gender;

  const [isEditing, setIsEditing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [form, setForm] = useState<ProfileFormFields>({
    name: name || '',
    age: age || '',
    gender: gender || '',
  });

  // Keep the form in sync when the underlying user changes (e.g. after a save).
  useEffect(() => {
    setForm({ name: name || '', age: age || '', gender: gender || '' });
  }, [name, age, gender]);

  const resetToUser = useCallback(() => {
    setForm({ name: name || '', age: age || '', gender: gender || '' });
  }, [name, age, gender]);

  const updateField = useCallback(
    (field: keyof ProfileFormFields, value: string) => {
      setForm(prev => ({ ...prev, [field]: value }));
    },
    [],
  );

  const handleEditPress = useCallback(() => {
    setIsEditing(prev => !prev);
  }, []);

  const handleCancelPress = useCallback(() => {
    resetToUser();
    setIsEditing(false);
  }, [resetToUser]);

  const handleSavePress = useCallback(async () => {
    try {
      await updateProfile(form.name, form.age, form.gender);
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to update profile:', error);
    }
  }, [updateProfile, form]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    resetToUser();
    setRefreshing(false);
  }, [resetToUser]);

  return {
    form,
    updateField,
    isEditing,
    refreshing,
    isLoading,
    handleEditPress,
    handleCancelPress,
    handleSavePress,
    handleRefresh,
  };
}
