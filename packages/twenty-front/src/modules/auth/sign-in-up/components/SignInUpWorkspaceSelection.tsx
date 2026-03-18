import { availableWorkspacesState } from '@/auth/states/availableWorkspacesState';
import { returnToPathState } from '@/auth/states/returnToPathState';
import { useBuildWorkspaceUrl } from '@/domain-manager/hooks/useBuildWorkspaceUrl';
import { styled } from '@linaria/react';
import { Trans, useLingui } from '@lingui/react/macro';
import { ClickToActionLink, UndecoratedLink } from 'twenty-ui/navigation';

import { useAuth } from '@/auth/hooks/useAuth';
import { useSignInUpForm } from '@/auth/sign-in-up/hooks/useSignInUpForm';
import { useSignUpInNewWorkspace } from '@/auth/sign-in-up/hooks/useSignUpInNewWorkspace';
import { getAvailableWorkspacePathAndSearchParams } from '@/auth/utils/availableWorkspacesUtils';
import { DEFAULT_WORKSPACE_LOGO } from '@/ui/navigation/navigation-drawer/constants/DefaultWorkspaceLogo';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { isNonEmptyString } from '@sniptt/guards';
import { useContext } from 'react';
import {
  Avatar,
  IconChevronRight,
  IconPlus,
} from 'twenty-ui/display';
import { ThemeContext, themeCssVariables } from 'twenty-ui/theme-constants';
import { type AvailableWorkspace } from '~/generated-metadata/graphql';
import { getWorkspaceUrl } from '~/utils/getWorkspaceUrl';

const StyledWorkspaceContainer = styled.div`
  background-color: ${themeCssVariables.background.secondary};
  border: 1px solid ${themeCssVariables.border.color.light};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  margin-bottom: ${themeCssVariables.spacing[8]};
  margin-top: ${themeCssVariables.spacing[4]};
  overflow: hidden;
  width: 100%;

  > * {
    border-bottom: 1px solid ${themeCssVariables.border.color.medium};

    &:last-child {
      border-bottom: none;
    }
  }
`;

const StyledWorkspaceItem = styled.div`
  align-items: center;
  cursor: pointer;
  display: flex;
  flex-direction: row;
  height: ${themeCssVariables.spacing[15]};
  justify-content: space-between;
  overflow: hidden;

  padding: 0;
  width: 100%;

  &:hover {
    background-color: ${themeCssVariables.background.transparent.light};
  }

  &:last-child {
    border-bottom: none;
  }
`;

const StyledWorkspaceContent = styled.div`
  align-items: center;
  display: flex;
  gap: ${themeCssVariables.spacing[4]};
  padding: 0 ${themeCssVariables.spacing[4]};
  width: 100%;
`;

const StyledWorkspaceTextContainer = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
`;

const StyledWorkspaceLogo = styled.div`
  align-items: center;
  background-color: ${themeCssVariables.background.transparent.light};
  border-radius: ${themeCssVariables.border.radius.sm};
  display: flex;
  height: ${themeCssVariables.spacing[6]};
  justify-content: center;
  width: ${themeCssVariables.spacing[6]};
`;

const StyledWorkspaceName = styled.div`
  color: ${themeCssVariables.font.color.primary};
  font-weight: ${themeCssVariables.font.weight.medium};
  padding-bottom: ${themeCssVariables.spacing[1]};
`;

const StyledWorkspaceUrl = styled.div`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledChevronIcon = styled.div`
  align-items: center;
  color: ${themeCssVariables.font.color.tertiary};
  display: flex;
`;

const StyledActionLinkContainer = styled.div`
  display: flex;
  justify-content: center;
`;

export const SignInUpWorkspaceSelection = () => {
  const { theme } = useContext(ThemeContext);
  const { buildWorkspaceUrl } = useBuildWorkspaceUrl();
  const { signOut } = useAuth();

  const { createWorkspace } = useSignUpInNewWorkspace();
  const availableWorkspaces = useAtomStateValue(availableWorkspacesState);
  const { t } = useLingui();

  const { form } = useSignInUpForm();
  const returnToPath = useAtomStateValue(returnToPathState);

  const getAvailableWorkspaceUrl = (availableWorkspace: AvailableWorkspace) => {
    const { pathname, searchParams } = getAvailableWorkspacePathAndSearchParams(
      availableWorkspace,
      { email: form.getValues('email') },
    );

    return buildWorkspaceUrl(
      getWorkspaceUrl(availableWorkspace.workspaceUrls),
      pathname,
      {
        ...searchParams,
        ...(isNonEmptyString(returnToPath) ? { returnToPath } : {}),
      },
    );
  };

  return (
    <>
      <StyledWorkspaceContainer>
        {[
          ...availableWorkspaces.availableWorkspacesForSignIn,
          ...availableWorkspaces.availableWorkspacesForSignUp,
        ].map((availableWorkspace) => (
          <UndecoratedLink
            key={availableWorkspace.id}
            to={getAvailableWorkspaceUrl(availableWorkspace)}
          >
            <StyledWorkspaceItem>
              <StyledWorkspaceContent>
                <Avatar
                  placeholder={availableWorkspace.displayName || ''}
                  avatarUrl={
                    availableWorkspace.logo ?? DEFAULT_WORKSPACE_LOGO
                  }
                  size="lg"
                />
                <StyledWorkspaceTextContainer>
                  <StyledWorkspaceName>
                    {availableWorkspace.displayName ||
                      availableWorkspace.id}
                  </StyledWorkspaceName>
                  <StyledWorkspaceUrl>
                    {
                      new URL(
                        getWorkspaceUrl(availableWorkspace.workspaceUrls),
                      ).hostname
                    }
                  </StyledWorkspaceUrl>
                </StyledWorkspaceTextContainer>
                <StyledChevronIcon>
                  <IconChevronRight size={theme.icon.size.md} />
                </StyledChevronIcon>
              </StyledWorkspaceContent>
            </StyledWorkspaceItem>
          </UndecoratedLink>
        ))}
        <StyledWorkspaceItem onClick={() => createWorkspace()}>
          <StyledWorkspaceContent>
            <StyledWorkspaceLogo>
              <IconPlus size={theme.icon.size.lg} />
            </StyledWorkspaceLogo>
            <StyledWorkspaceTextContainer>
              <StyledWorkspaceName>{t`Create a workspace`}</StyledWorkspaceName>
            </StyledWorkspaceTextContainer>
            <StyledChevronIcon>
              <IconChevronRight size={theme.icon.size.md} />
            </StyledChevronIcon>
          </StyledWorkspaceContent>
        </StyledWorkspaceItem>
      </StyledWorkspaceContainer>
      <StyledActionLinkContainer>
        <ClickToActionLink onClick={signOut}>
          <Trans>Log out</Trans>
        </ClickToActionLink>
      </StyledActionLinkContainer>
    </>
  );
};
