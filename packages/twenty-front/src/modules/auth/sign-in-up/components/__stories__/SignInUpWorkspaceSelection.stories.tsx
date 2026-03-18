import { type Meta, type StoryObj } from '@storybook/react-vite';

import { SignInUpWorkspaceSelection } from '@/auth/sign-in-up/components/SignInUpWorkspaceSelection';
import { availableWorkspacesState } from '@/auth/states/availableWorkspacesState';
import { ComponentDecorator } from 'twenty-ui/testing';
import { jotaiStore } from '@/ui/utilities/state/jotai/jotaiStore';

const meta: Meta<typeof SignInUpWorkspaceSelection> = {
  title: 'Modules/Auth/SignInUpWorkspaceSelection',
  component: SignInUpWorkspaceSelection,
  decorators: [
    ComponentDecorator,
    (Story) => {
      jotaiStore.set(availableWorkspacesState.atom, {
        availableWorkspacesForSignIn: [
          {
            id: 'workspace-1',
            displayName: 'Workspace 1',
            logo: 'https://via.placeholder.com/150',
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
      return <Story />;
    },
  ],
};

export default meta;
type Story = StoryObj<typeof SignInUpWorkspaceSelection>;

export const Default: Story = {};
