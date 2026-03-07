import { useEffect } from 'react';
import { onIdTokenChanged } from 'firebase/auth';

import { auth } from '~/modules/auth/firebase';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { currentUserState } from '@/auth/states/currentUserState';
import { useLoadCurrentUser } from '@/users/hooks/useLoadCurrentUser';

export const useOnAuthStateChanged = () => {
  const setTokenPair = useSetAtomState(tokenPairState);
  const setCurrentUser = useSetAtomState(currentUserState);
  const { loadCurrentUser } = useLoadCurrentUser();

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (user) => {
      if (user) {
        // User is signed in, get the new token
        const token = await user.getIdToken();

        // Update local token pair state
        setTokenPair((prev) => {
          if (!prev) {
            return {
              accessOrWorkspaceAgnosticToken: { token, expiresAt: '' },
              refreshToken: { token: '', expiresAt: '' },
            };
          }
          return {
            ...prev,
            accessOrWorkspaceAgnosticToken: { token, expiresAt: '' },
          };
        });

        // Update current user state
        const { user: currentUser } = await loadCurrentUser();
        setCurrentUser(currentUser);
      } else {
        // User is signed out, clear the local states
        setTokenPair(null);
        setCurrentUser(null);
      }
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, [setTokenPair, setCurrentUser, loadCurrentUser]);
};
