import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { ApolloError } from '@apollo/client';
import { AppPath } from 'twenty-shared/types';

import { verifyEmailRedirectPathState } from '@/app/states/verifyEmailRedirectPathState';
import { useVerifyLogin } from '@/auth/hooks/useVerifyLogin';
import { clientConfigApiStatusState } from '@/client-config/states/clientConfigApiStatusState';
import { useIsCurrentLocationOnAWorkspace } from '@/domain-manager/hooks/useIsCurrentLocationOnAWorkspace';
import { useRedirectToWorkspaceDomain } from '@/domain-manager/hooks/useRedirectToWorkspaceDomain';
import { ModalContent } from 'twenty-ui/layout';
import { useLingui } from '@lingui/react/macro';
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { isDefined } from 'twenty-shared/utils';
import { useNavigateApp } from '~/hooks/useNavigateApp';
import { getWorkspaceUrl } from '~/utils/getWorkspaceUrl';
import { EmailVerificationSent } from '@/auth/sign-in-up/components/EmailVerificationSent';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { applyActionCode } from 'firebase/auth';
import { auth } from '~/modules/auth/firebase';
import { useLoadCurrentUser } from '@/users/hooks/useLoadCurrentUser';

export const VerifyEmailEffect = () => {
  const { enqueueErrorSnackBar, enqueueSuccessSnackBar } = useSnackBar();

  const [searchParams] = useSearchParams();
  const [isError, setIsError] = useState(false);

  const setVerifyEmailRedirectPath = useSetAtomState(
    verifyEmailRedirectPathState,
  );

  const email = searchParams.get('email');
  const oobCode = searchParams.get('oobCode');
  const verifyEmailRedirectPath = searchParams.get('nextPath');

  const navigate = useNavigateApp();
  const { redirectToWorkspaceDomain } = useRedirectToWorkspaceDomain();
  const { verifyLoginToken } = useVerifyLogin();
  const { isOnAWorkspace } = useIsCurrentLocationOnAWorkspace();
  const clientConfigApiStatus = useAtomStateValue(clientConfigApiStatusState);
  const { loadCurrentUser } = useLoadCurrentUser();

  const { t } = useLingui();

  useEffect(() => {
    const verifyEmailToken = async () => {
      // Firebase email verification link includes an oobCode parameter instead of emailVerificationToken
      const actionCode = oobCode || searchParams.get('emailVerificationToken');

      if (!actionCode) {
        enqueueErrorSnackBar({
          message: t`Invalid email verification link.`,
          options: {
            dedupeKey: 'email-verification-link-dedupe-key',
          },
        });
        return navigate(AppPath.SignInUp);
      }

      const successSnackbarParams = {
        message: t`Email verified.`,
        options: {
          dedupeKey: 'email-verification-dedupe-key',
        },
      };

      try {
        await applyActionCode(auth, actionCode);

        enqueueSuccessSnackBar(successSnackbarParams);

        // At this point, the user's email is verified in Firebase.
        // We load the current user from our backend to check workspaces.
        const { user } = await loadCurrentUser();

        // After verification, we could navigate to workspace selection or
        // a specific workspace if they only have one
        if (isDefined(verifyEmailRedirectPath)) {
          setVerifyEmailRedirectPath(verifyEmailRedirectPath);
        }

        // Navigate to the main app if on a workspace, or to workspace selection if not
        if (isOnAWorkspace) {
          navigate(AppPath.Index);
        } else {
           navigate(AppPath.SignInUp);
        }

      } catch (error) {
        enqueueErrorSnackBar({
          ...(error instanceof Error
            ? { message: error.message }
            : { message: t`Email verification failed` }),
          options: {
            dedupeKey: 'email-verification-error-dedupe-key',
          },
        });

        if (
          error instanceof Error &&
          error.message.includes('auth/invalid-action-code')
        ) {
          navigate(AppPath.SignInUp);
        }

        setIsError(true);
      }
    };

    if (!clientConfigApiStatus.isLoadedOnce) {
      return;
    }

    verifyEmailToken();

    // Verify email only needs to run once at mount
    // oxlint-disable-next-line react-hooks/exhaustive-deps
  }, [clientConfigApiStatus.isLoadedOnce]);

  if (isError) {
    return (
      <ModalContent isVerticallyCentered isHorizontallyCentered>
        <EmailVerificationSent email={email} isError={true} />
      </ModalContent>
    );
  }

  return <></>;
};
