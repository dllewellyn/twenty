import { styled } from '@linaria/react';
import { FormProvider } from 'react-hook-form';

import { SignInUpWithCredentials } from '@/auth/sign-in-up/components/internal/SignInUpWithCredentials';
import { SignInUpWithGoogle } from '@/auth/sign-in-up/components/internal/SignInUpWithGoogle';
import { SignInUpWithMicrosoft } from '@/auth/sign-in-up/components/internal/SignInUpWithMicrosoft';
import { useHandleResetPassword } from '@/auth/sign-in-up/hooks/useHandleResetPassword';
import { useSignInUpForm } from '@/auth/sign-in-up/hooks/useSignInUpForm';
import {
  SignInUpStep,
  signInUpStepState,
} from '@/auth/states/signInUpStepState';
import { authProvidersState } from '@/client-config/states/authProvidersState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { motion } from 'framer-motion';
import { HorizontalSeparator } from 'twenty-ui/display';
import { ClickToActionLink } from 'twenty-ui/navigation';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { Trans } from '@lingui/react/macro';

const StyledContentContainer = styled(motion.div)`
  margin-bottom: ${themeCssVariables.spacing[8]};
  margin-top: ${themeCssVariables.spacing[4]};
  min-width: 200px;
`;

const StyledForgotPasswordLinkContainer = styled.div`
  display: flex;
  justify-content: center;
  padding-top: ${themeCssVariables.spacing[4]};
`;

export const SignInUpGlobalScopeForm = () => {
  const authProviders = useAtomStateValue(authProvidersState);
  const signInUpStep = useAtomStateValue(signInUpStepState);

  const { form } = useSignInUpForm();
  const { handleResetPassword } = useHandleResetPassword();

  return (
    <StyledContentContainer>
      {authProviders.google && (
        <SignInUpWithGoogle
          action="list-available-workspaces"
          isGlobalScope
        />
      )}
      {authProviders.microsoft && (
        <SignInUpWithMicrosoft
          action="list-available-workspaces"
          isGlobalScope
        />
      )}
      {(authProviders.google || authProviders.microsoft) && (
        <HorizontalSeparator />
      )}
      {/* oxlint-disable-next-line react/jsx-props-no-spreading */}
      <FormProvider {...form}>
        <SignInUpWithCredentials isGlobalScope />
      </FormProvider>
      {signInUpStep === SignInUpStep.Password && (
        <StyledForgotPasswordLinkContainer>
          <ClickToActionLink
            onClick={handleResetPassword(form.getValues('email'))}
          >
            <Trans>Forgot your password?</Trans>
          </ClickToActionLink>
        </StyledForgotPasswordLinkContainer>
      )}
    </StyledContentContainer>
  );
};
