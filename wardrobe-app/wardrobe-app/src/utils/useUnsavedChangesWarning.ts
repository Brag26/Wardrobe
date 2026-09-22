// src/utils/useUnsavedChangesWarning.ts
// QA flagged: leaving a create/edit screen with unsaved changes (back
// button, gesture, or tapping another tab) gave no warning at all —
// work could be lost silently. One shared hook instead of copying the
// same beforeRemove-listener boilerplate into every create/edit
// screen separately, so the behavior (and its wording) stays
// consistent everywhere it's used.
//
// hasUnsavedChanges should be a function (not a plain boolean) so it's
// evaluated at the moment navigation is actually attempted, not
// captured stale at mount time.
import { useEffect } from 'react';
import { useNavigation } from '@react-navigation/native';
import { Alert } from 'react-native';

export function useUnsavedChangesWarning(hasUnsavedChanges: () => boolean) {
  const navigation = useNavigation<any>();

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      if (!hasUnsavedChanges()) return; // nothing to lose, let it go
      e.preventDefault();
      Alert.alert(
        'Discard changes?',
        "You have unsaved changes. If you leave now, they'll be lost.",
        [
          { text: 'Keep editing', style: 'cancel' },
          { text: 'Discard', style: 'destructive', onPress: () => navigation.dispatch(e.data.action) },
        ]
      );
    });
    return unsubscribe;
  }, [navigation, hasUnsavedChanges]);
}
