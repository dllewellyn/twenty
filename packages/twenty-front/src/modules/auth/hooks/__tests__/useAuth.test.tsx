import { renderHook, act } from '@testing-library/react';
import { useAuth } from '../useAuth';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import { MemoryRouter } from 'react-router-dom';
import { MockedProvider } from '@apollo/client/testing';
import { Provider } from 'jotai';

// Mock useLingui as well
jest.mock('@lingui/react/macro', () => ({
  useLingui: () => ({ t: (str: string) => str }),
}));

// We mock the snackbar hook completely to bypass the UI dependencies if needed
jest.mock('@/ui/feedback/snack-bar-manager/hooks/useSnackBar', () => ({
  useSnackBar: () => ({
    enqueueSnackBar: jest.fn(),
    enqueueErrorSnackBar: jest.fn(),
    enqueueSuccessSnackBar: jest.fn(),
  }),
}));

// Mock useSignUpInNewWorkspace to bypass further Lingui deps in it
jest.mock('@/auth/sign-in-up/hooks/useSignUpInNewWorkspace', () => ({
  useSignUpInNewWorkspace: () => ({
    createWorkspace: jest.fn(),
  }),
}));

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <MockedProvider>
    <MemoryRouter>
      <Provider>
        {children}
      </Provider>
    </MemoryRouter>
  </MockedProvider>
);

jest.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: jest.fn().mockResolvedValue({ user: { getIdToken: jest.fn().mockResolvedValue('token') } }),
  createUserWithEmailAndPassword: jest.fn().mockResolvedValue({ user: { getIdToken: jest.fn().mockResolvedValue('token') } }),
  sendEmailVerification: jest.fn(),
  signOut: jest.fn(),
  getAuth: jest.fn(),
}));

jest.mock('~/modules/auth/firebase', () => ({
  auth: {},
}));

jest.mock('@/users/hooks/useLoadCurrentUser', () => ({
  useLoadCurrentUser: () => ({
    loadCurrentUser: jest.fn().mockResolvedValue({ user: { availableWorkspaces: [] } }),
  }),
}));

describe('useAuth', () => {
  it('should call signInWithEmailAndPassword', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await act(async () => {
      try {
        await result.current.signInWithCredentials('test@test.com', 'password');
      } catch (e) {
        // Handle workspace creation redirect catch
      }
    });

    expect(signInWithEmailAndPassword).toHaveBeenCalled();
  });

  it('should call createUserWithEmailAndPassword', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await act(async () => {
      try {
        await result.current.signUpWithCredentials('test@test.com', 'password');
      } catch (e) {
         // Catch if there are mock errors
      }
    });

    expect(createUserWithEmailAndPassword).toHaveBeenCalled();
  });

  it('should sign out from Firebase', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.signOut();
    });

    expect(signOut).toHaveBeenCalled();
  });
});
