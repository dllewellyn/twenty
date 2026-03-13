import { ApolloError, useApolloClient } from '@apollo/client';
import { useCallback } from 'react';
import { AppPath } from 'twenty-shared/types';

import { REACT_APP_SERVER_BASE_URL } from '~/config';
import {
  useCheckUserExistsLazyQuery,
  type AuthToken,
  type AuthTokenPair,
} from '~/generated-metadata/graphql';

import { tokenPairState } from '@/auth/states/tokenPairState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';

import { isAppEffectRedirectEnabledState } from '@/app/states/isAppEffectRedirectEnabledState';
import { availableWorkspacesState } from '@/auth/states/availableWorkspacesState';
import { currentUserState } from '@/auth/states/currentUserState';
import { currentUserWorkspaceState } from '@/auth/states/currentUserWorkspaceState';
import { currentWorkspaceMemberState } from '@/auth/states/currentWorkspaceMemberState';
import { currentWorkspaceMembersState } from '@/auth/states/currentWorkspaceMembersState';
import { currentWorkspaceState } from '@/auth/states/currentWorkspaceState';
import { useSignUpInNewWorkspace } from '@/auth/sign-in-up/hooks/useSignUpInNewWorkspace';
import { useReloadWorkspaceMetadata } from '@/metadata-store/hooks/useReloadWorkspaceMetadata';
import { lastAuthenticatedMethodState } from '@/auth/states/lastAuthenticatedMethodState';
import { loginTokenState } from '@/auth/states/loginTokenState';
import {
  SignInUpStep,
  signInUpStepState,
} from '@/auth/states/signInUpStepState';
import { workspacePublicDataState } from '@/auth/states/workspacePublicDataState';
import { coreViewsState } from '@/views/states/coreViewState';
import { type BillingCheckoutSession } from '@/auth/types/billingCheckoutSession.type';
import {
  countAvailableWorkspaces,
  getFirstAvailableWorkspaces,
} from '@/auth/utils/availableWorkspacesUtils';
import { useRequestFreshCaptchaToken } from '@/captcha/hooks/useRequestFreshCaptchaToken';
import { isCaptchaScriptLoadedState } from '@/captcha/states/isCaptchaScriptLoadedState';
import { isEmailVerificationRequiredState } from '@/client-config/states/isEmailVerificationRequiredState';
import { useLastAuthenticatedWorkspaceDomain } from '@/domain-manager/hooks/useLastAuthenticatedWorkspaceDomain';
import { useRedirect } from '@/domain-manager/hooks/useRedirect';
import { useRedirectToWorkspaceDomain } from '@/domain-manager/hooks/useRedirectToWorkspaceDomain';
import { domainConfigurationState } from '@/domain-manager/states/domainConfigurationState';
import { sseClientState } from '@/sse-db-event/states/sseClientState';
import { useLoadCurrentUser } from '@/users/hooks/useLoadCurrentUser';
import { workspaceAuthProvidersState } from '@/workspace/states/workspaceAuthProvidersState';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { isDefined } from 'twenty-shared/utils';
import { cookieStorage } from '~/utils/cookie-storage';
import { getWorkspaceUrl } from '~/utils/getWorkspaceUrl';
import { useStore } from 'jotai';

import { auth } from '~/modules/auth/firebase';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendEmailVerification,
} from 'firebase/auth';

export const useAuth = () => {
  const store = useStore();
  const setTokenPair = useSetAtomState(tokenPairState);
  const setLoginToken = useSetAtomState(loginTokenState);
  const setIsAppEffectRedirectEnabled = useSetAtomState(
    isAppEffectRedirectEnabledState,
  );

  const { requestFreshCaptchaToken } = useRequestFreshCaptchaToken();
  const isCaptchaScriptLoaded = useAtomStateValue(isCaptchaScriptLoadedState);
  const isEmailVerificationRequired = useAtomStateValue(
    isEmailVerificationRequiredState,
  );
  const { loadCurrentUser } = useLoadCurrentUser();

  const { reloadWorkspaceMetadata, resetToMockedMetadata } =
    useReloadWorkspaceMetadata();
  const { createWorkspace } = useSignUpInNewWorkspace();

  const setSignInUpStep = useSetAtomState(signInUpStepState);
  const { redirect } = useRedirect();
  const { redirectToWorkspaceDomain } = useRedirectToWorkspaceDomain();

  const workspacePublicData = useAtomStateValue(workspacePublicDataState);

  const { setLastAuthenticateWorkspaceDomain } =
    useLastAuthenticatedWorkspaceDomain();
  const [checkUserExistsQuery, { data: checkUserExistsData }] =
    useCheckUserExistsLazyQuery();

  const client = useApolloClient();

  const [, setSearchParams] = useSearchParams();

  const navigate = useNavigate();

  const clearSession = useCallback(async () => {
    const sseClient = store.get(sseClientState.atom);

    sseClient?.dispose();

    const authProvidersValue = store.get(workspaceAuthProvidersState.atom);
    const domainConfigurationValue = store.get(domainConfigurationState.atom);
    const workspacePublicDataValue = store.get(workspacePublicDataState.atom);
    const lastAuthenticatedMethod = store.get(
      lastAuthenticatedMethodState.atom,
    );
    const isCaptchaScriptLoadedValue = store.get(
      isCaptchaScriptLoadedState.atom,
    );

    store.set(isAppEffectRedirectEnabledState.atom, false);

    sessionStorage.clear();
    localStorage.clear();

    store.set(workspaceAuthProvidersState.atom, authProvidersValue);
    store.set(workspacePublicDataState.atom, workspacePublicDataValue);
    store.set(domainConfigurationState.atom, domainConfigurationValue);
    store.set(isCaptchaScriptLoadedState.atom, isCaptchaScriptLoadedValue);
    store.set(lastAuthenticatedMethodState.atom, lastAuthenticatedMethod);

    store.set(tokenPairState.atom, null);
    store.set(currentUserState.atom, null);
    store.set(currentWorkspaceState.atom, null);
    store.set(currentUserWorkspaceState.atom, null);
    store.set(currentWorkspaceMemberState.atom, null);
    store.set(currentWorkspaceMembersState.atom, []);
    store.set(availableWorkspacesState.atom, {
      availableWorkspacesForSignIn: [],
      availableWorkspacesForSignUp: [],
    });
    store.set(loginTokenState.atom, null);
    store.set(signInUpStepState.atom, SignInUpStep.Init);
    store.set(coreViewsState.atom, []);

    await client.clearStore();
    setLastAuthenticateWorkspaceDomain(null);
    await resetToMockedMetadata();
    navigate(AppPath.SignInUp);
    store.set(isAppEffectRedirectEnabledState.atom, true);
  }, [
    client,
    setLastAuthenticateWorkspaceDomain,
    resetToMockedMetadata,
    navigate,
    store,
  ]);

  const handleSetAuthTokens = useCallback(
    (tokens: AuthTokenPair) => {
      setTokenPair(tokens);
      cookieStorage.setItem('tokenPair', JSON.stringify(tokens));
    },
    [setTokenPair],
  );

  const handleCredentialsSignIn = useCallback(
    async (email: string, password: string, captchaToken?: string) => {
      try {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          email,
          password,
        );
        const token = await userCredential.user.getIdToken();

        handleSetAuthTokens({
          accessOrWorkspaceAgnosticToken: {
            token: token,
            expiresAt: '', // the exact expiration is handled by Firebase
          },
          refreshToken: {
            token: '', // Handled by firebase
            expiresAt: '',
          },
        });

        const { user } = await loadCurrentUser();

        const availableWorkspacesCount = countAvailableWorkspaces(
          user.availableWorkspaces,
        );

        if (availableWorkspacesCount === 0) {
          return createWorkspace();
        }

        if (availableWorkspacesCount === 1) {
          const targetWorkspace = getFirstAvailableWorkspaces(
            user.availableWorkspaces,
          );
          return await redirectToWorkspaceDomain(
            getWorkspaceUrl(targetWorkspace.workspaceUrls),
            targetWorkspace.loginToken ? AppPath.Verify : AppPath.SignInUp,
            {
              ...(targetWorkspace.loginToken && {
                loginToken: targetWorkspace.loginToken,
              }),
              email: user.email,
            },
          );
        }

        setSignInUpStep(SignInUpStep.WorkspaceSelection);
      } catch (error: unknown) {
        if (
          (error as Error).message?.includes('auth/unverified-email') ||
          (error as Error).message?.includes('EMAIL_NOT_VERIFIED') ||
          (error instanceof ApolloError &&
            error.graphQLErrors[0]?.extensions?.subCode ===
              'EMAIL_NOT_VERIFIED')
        ) {
          setSearchParams({ email });
          setSignInUpStep(SignInUpStep.EmailVerification);
          throw error;
        }
        throw error;
      }
    },
    [
      handleSetAuthTokens,
      redirectToWorkspaceDomain,
      loadCurrentUser,
      setSearchParams,
      setSignInUpStep,
      createWorkspace,
    ],
  );

  const handleCredentialsSignUp = useCallback(
    async (email: string, password: string, captchaToken?: string) => {
      // First, create the user with Firebase
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password,
      );
      const token = await userCredential.user.getIdToken();

      if (isEmailVerificationRequired) {
        await sendEmailVerification(userCredential.user);
        setSearchParams({ email });
        setSignInUpStep(SignInUpStep.EmailVerification);
        return null;
      }

      handleSetAuthTokens({
        accessOrWorkspaceAgnosticToken: {
          token: token,
          expiresAt: '', // handled by firebase
        },
        refreshToken: {
          token: '', // Handled by firebase
          expiresAt: '',
        },
      });

      const { user } = await loadCurrentUser();

      if (countAvailableWorkspaces(user.availableWorkspaces) === 0) {
        return await createWorkspace({ newTab: false });
      }

      setSignInUpStep(SignInUpStep.WorkspaceSelection);
    },
    [
      isEmailVerificationRequired,
      setSearchParams,
      handleSetAuthTokens,
      loadCurrentUser,
      setSignInUpStep,
      createWorkspace,
    ],
  );

  const handleCredentialsSignInInWorkspace = useCallback(
    async (email: string, password: string, captchaToken?: string) => {
      // Firebase auth is global, so we can just use the same handler
      await handleCredentialsSignIn(email, password, captchaToken);
    },
    [handleCredentialsSignIn],
  );

  const handleCredentialsSignUpInWorkspace = useCallback(
    async ({
      email,
      password,
      captchaToken,
    }: {
      email: string;
      password: string;
      captchaToken?: string;
    }) => {
      // Firebase auth is global, so we can just use the same handler
      await handleCredentialsSignUp(email, password, captchaToken);
    },
    [handleCredentialsSignUp],
  );

  const handleSignOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Firebase sign out error:', error);
    }
    await clearSession();
    if (isCaptchaScriptLoaded) await requestFreshCaptchaToken();
  }, [clearSession, isCaptchaScriptLoaded, requestFreshCaptchaToken]);

  const buildRedirectUrl = useCallback(
    (
      path: string,
      params: {
        workspacePersonalInviteToken?: string;
        workspaceInviteHash?: string;
        billingCheckoutSession?: BillingCheckoutSession;
        action?: string;
      },
    ) => {
      const url = new URL(`${REACT_APP_SERVER_BASE_URL}${path}`);
      if (isDefined(params.workspaceInviteHash)) {
        url.searchParams.set('workspaceInviteHash', params.workspaceInviteHash);
      }
      if (isDefined(params.workspacePersonalInviteToken)) {
        url.searchParams.set(
          'inviteToken',
          params.workspacePersonalInviteToken,
        );
      }
      if (isDefined(params.billingCheckoutSession)) {
        url.searchParams.set(
          'billingCheckoutSessionState',
          JSON.stringify(params.billingCheckoutSession),
        );
      }

      if (isDefined(params.action)) {
        url.searchParams.set('action', params.action);
      }

      if (isDefined(workspacePublicData)) {
        url.searchParams.set('workspaceId', workspacePublicData.id);
      }

      return url.toString();
    },
    [workspacePublicData],
  );

  const handleGoogleLogin = useCallback(
    (params: {
      workspacePersonalInviteToken?: string;
      workspaceInviteHash?: string;
      billingCheckoutSession?: BillingCheckoutSession;
      action: string;
    }) => {
      redirect(buildRedirectUrl('/auth/google', params));
    },
    [buildRedirectUrl, redirect],
  );

  const handleMicrosoftLogin = useCallback(
    (params: {
      workspacePersonalInviteToken?: string;
      workspaceInviteHash?: string;
      billingCheckoutSession?: BillingCheckoutSession;
      action: string;
    }) => {
      redirect(buildRedirectUrl('/auth/microsoft', params));
    },
    [buildRedirectUrl, redirect],
  );

  return {
    checkUserExists: { checkUserExistsData, checkUserExistsQuery },
    clearSession,
    signOut: handleSignOut,
    signUpWithCredentials: handleCredentialsSignUp,
    signUpWithCredentialsInWorkspace: handleCredentialsSignUpInWorkspace,
    signInWithCredentialsInWorkspace: handleCredentialsSignInInWorkspace,
    signInWithCredentials: handleCredentialsSignIn,
    signInWithGoogle: handleGoogleLogin,
    signInWithMicrosoft: handleMicrosoftLogin,
    setAuthTokens: handleSetAuthTokens,
    getAuthTokensFromOTP: async (otp: string, loginToken: string, captchaToken?: string) => { throw new Error('2FA is temporarily unavailable'); },
  };
};
