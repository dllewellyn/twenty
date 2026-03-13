import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { useLingui } from '@lingui/react/macro';

export const useSignUpInNewWorkspace = () => {
  const { enqueueErrorSnackBar } = useSnackBar();
  const { t } = useLingui();

  const createWorkspace = async ({ newTab } = { newTab: true }) => {
    // The legacy GraphQL mutation 'signUpInNewWorkspace' was removed.
    // Workspace creation is temporarily disabled during migration,
    // or should be handled by a specific new backend method once provided.
    enqueueErrorSnackBar({
      message: t`Workspace creation is temporarily disabled during migration`,
    });
  };

  return {
    createWorkspace,
  };
};
