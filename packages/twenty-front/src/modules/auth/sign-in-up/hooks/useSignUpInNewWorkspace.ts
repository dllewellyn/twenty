import { useRedirectToWorkspaceDomain } from '@/domain-manager/hooks/useRedirectToWorkspaceDomain';
import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { AppPath } from 'twenty-shared/types';
import { useLingui } from '@lingui/react/macro';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import { getWorkspaceUrl } from '~/utils/getWorkspaceUrl';
import { useAuth } from '@/auth/hooks/useAuth';
import { auth } from '~/modules/auth/firebase';
import { isDefined } from 'twenty-shared/utils';

export const useSignUpInNewWorkspace = () => {
  const { redirectToWorkspaceDomain } = useRedirectToWorkspaceDomain();
  const { enqueueErrorSnackBar } = useSnackBar();
  const { t } = useLingui();

  const createWorkspace = async ({ newTab } = { newTab: true }) => {
    try {
      const currentUser = auth.currentUser;

      if (!isDefined(currentUser)) {
        throw new Error(t`User must be authenticated to create a workspace`);
      }

      const idToken = await currentUser.getIdToken();

      // We call the generic REST auth endpoint for workspace creation during signup.
      // Since the GraphQL endpoints for workspace creation during signup were removed during the Firebase refactor,
      // this relies on the backend's new standard pattern.
      const response = await fetch(`${REACT_APP_SERVER_BASE_URL}/auth/workspaces`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
      });

      if (!response.ok) {
        throw new Error(t`Failed to create workspace`);
      }

      const data = await response.json();

      // We expect the backend to return workspaceUrls
      return await redirectToWorkspaceDomain(
        getWorkspaceUrl(data.workspaceUrls),
        AppPath.Verify,
        {
          ...(data.loginToken && { loginToken: data.loginToken }),
        },
        newTab ? '_blank' : '_self',
      );
    } catch (error) {
      enqueueErrorSnackBar({
        message: error instanceof Error ? error.message : t`Workspace creation failed`,
      });
    }
  };

  return {
    createWorkspace,
  };
};
