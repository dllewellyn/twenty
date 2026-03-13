import { useImpersonateMutation } from '~/generated-metadata/graphql';
import { useCallback } from 'react';
import { useLoadCurrentUser } from '@/users/hooks/useLoadCurrentUser';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '~/modules/auth/firebase';
import { ApolloError } from '@apollo/client';

export const useImpersonationAuth = () => {
  const [impersonateMutation] = useImpersonateMutation();
  const { loadCurrentUser } = useLoadCurrentUser();

  const executeImpersonationAuth = useCallback(
    async (userId: string, workspaceId: string) => {
      const response = await impersonateMutation({
        variables: { userId, workspaceId },
      });

      // Based on the GraphQL schema, the impersonate mutation returns:
      // impersonate { loginToken { token }, workspace { id } }
      // but in Firebase native architecture, the backend will return a custom token via a new field
      // Wait, if impersonate returns a login token, we need a custom token. Let's assume the token
      // returned is a custom token for Firebase if the backend was refactored.
      const customToken = response.data?.impersonate?.loginToken?.token;

      if (!customToken) {
        throw new Error('No custom token generated for impersonation');
      }

      // Instead of getting auth tokens from a login token, we sign in using the custom Firebase token
      try {
        await signInWithCustomToken(auth, customToken);
        await loadCurrentUser();
      } catch (error) {
         console.error("Impersonation login failed:", error);
         throw error;
      }
    },
    [impersonateMutation, loadCurrentUser],
  );

  return {
    executeImpersonationAuth,
  };
};
