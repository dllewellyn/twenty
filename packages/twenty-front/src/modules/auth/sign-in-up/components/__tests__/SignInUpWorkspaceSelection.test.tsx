import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen } from '@testing-library/react';
import { Provider as JotaiProvider } from 'jotai';
import { MemoryRouter } from 'react-router-dom';
import { SOURCE_LOCALE } from 'twenty-shared/translations';
import { ThemeProvider } from 'twenty-ui/theme-constants';

import { SignInUpWorkspaceSelection } from '@/auth/sign-in-up/components/SignInUpWorkspaceSelection';
import { availableWorkspacesState } from '@/auth/states/availableWorkspacesState';
import {
  jotaiStore,
  resetJotaiStore,
} from '@/ui/utilities/state/jotai/jotaiStore';
import { dynamicActivate } from '~/utils/i18n/dynamicActivate';

const buildWorkspaceUrlMock = jest.fn();
const signOutMock = jest.fn();
const createWorkspaceMock = jest.fn();

jest.mock('@/auth/hooks/useAuth', () => ({
  useAuth: () => ({
    signOut: signOutMock,
  }),
}));

jest.mock('@/domain-manager/hooks/useBuildWorkspaceUrl', () => ({
  useBuildWorkspaceUrl: () => ({
    buildWorkspaceUrl: buildWorkspaceUrlMock,
  }),
}));

jest.mock('@/auth/sign-in-up/hooks/useSignUpInNewWorkspace', () => ({
  useSignUpInNewWorkspace: () => ({
    createWorkspace: createWorkspaceMock,
  }),
}));

jest.mock('@/auth/sign-in-up/hooks/useSignInUpForm', () => ({
  useSignInUpForm: () => ({
    form: {
      getValues: () => 'person@example.com',
    },
  }),
}));

dynamicActivate(SOURCE_LOCALE);

describe('SignInUpWorkspaceSelection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetJotaiStore();
  });

  it('renders available workspaces and create workspace option', () => {
    jotaiStore.set(availableWorkspacesState.atom, {
      availableWorkspacesForSignIn: [
        {
          id: 'workspace-1',
          displayName: 'Workspace 1',
          workspaceUrls: {
            customUrl: 'http://workspace1.twenty.com',
            subdomain: 'workspace1',
          },
        },
      ],
      availableWorkspacesForSignUp: [
        {
          id: 'workspace-2',
          displayName: 'Workspace 2',
          workspaceUrls: {
            customUrl: 'http://workspace2.twenty.com',
            subdomain: 'workspace2',
          },
        },
      ],
    });

    render(
      <MemoryRouter>
        <JotaiProvider store={jotaiStore}>
          <ThemeProvider colorScheme="light">
            <I18nProvider i18n={i18n}>
              <SignInUpWorkspaceSelection />
            </I18nProvider>
          </ThemeProvider>
        </JotaiProvider>
      </MemoryRouter>,
    );

    expect(screen.getByText('Workspace 1')).toBeInTheDocument();
    expect(screen.getByText('Workspace 2')).toBeInTheDocument();
    expect(screen.getByText('Create a workspace')).toBeInTheDocument();
    expect(screen.getByText('Log out')).toBeInTheDocument();
  });
});
