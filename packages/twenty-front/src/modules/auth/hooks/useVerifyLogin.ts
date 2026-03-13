import { useLoadCurrentUser } from '@/users/hooks/useLoadCurrentUser';
import { useCallback } from 'react';
import { useAuth } from '@/auth/hooks/useAuth';

export const useVerifyLogin = () => {
  const { loadCurrentUser } = useLoadCurrentUser();
  const { clearSession } = useAuth();

  const verifyLoginToken = useCallback(
    async (loginToken?: string) => {
      try {
        await loadCurrentUser();
      } catch (error) {
        await clearSession();
      }
    },
    [loadCurrentUser, clearSession],
  );

  return { verifyLoginToken };
};
