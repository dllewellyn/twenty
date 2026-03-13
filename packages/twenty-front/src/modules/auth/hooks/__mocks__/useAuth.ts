import { GetCurrentUserDocument } from '~/generated-metadata/graphql';

export const queries = {
  getCurrentUser: GetCurrentUserDocument,
};

export const email = 'test@test.com';
export const password = 'testing';
export const origin = 'http://localhost';
export const token =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

export const variables = {
  getCurrentUser: {},
};

export const results = {
  getCurrentUser: {
    currentUser: {
      id: 'id',
      firstName: 'firstName',
      lastName: 'lastName',
      email: 'email',
      canAccessFullAdminPanel: false,
      canImpersonate: 'canImpersonate',
      supportUserHash: 'supportUserHash',
      workspaceMember: {
        id: 'id',
        name: {
          firstName: 'firstName',
          lastName: 'lastName',
        },
        colorScheme: 'colorScheme',
        avatarUrl: 'avatarUrl',
        locale: 'locale',
      },
      availableWorkspaces: [],
      currentWorkspace: {
        id: 'id',
        displayName: 'displayName',
        logo: 'logo',
        inviteHash: 'inviteHash',
        allowImpersonation: true,
        subscriptionStatus: 'subscriptionStatus',
        customDomain: null,
        workspaceUrls: {
          customUrl: undefined,
          subdomainUrl: 'https://twenty.com',
        },
        featureFlags: {
          id: 'id',
          key: 'key',
          value: 'value',
          workspaceId: 'workspaceId',
        },
      },
    },
  },
};

export const mocks = {
  getCurrentUser: {
    request: {
      query: queries.getCurrentUser,
      variables: variables.getCurrentUser,
    },
    result: jest.fn(() => ({
      data: results.getCurrentUser,
    })),
  },
};
