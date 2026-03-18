import { render, screen, act } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'jotai';
import { RequireAuth } from '../RequireAuth';
import { isCurrentUserLoadedState } from '@/auth/states/isCurrentUserLoadedState';
import { tokenPairState } from '@/auth/states/tokenPairState';
import { useSetAtomState } from '@/ui/utilities/state/jotai/hooks/useSetAtomState';
import { AppPath } from 'twenty-shared/types';
import { useEffect } from 'react';

// Mock the loader to make it easy to find
jest.mock('~/loading/components/UserOrMetadataLoader', () => ({
  UserOrMetadataLoader: () => <div data-testid="loader">Loading...</div>,
}));

describe('RequireAuth', () => {
  const ProtectedContent = () => <div data-testid="protected">Protected content</div>;
  const SignInPage = () => <div data-testid="signin">Sign in page</div>;

  const StateInitializer = ({
    isLoaded,
    tokenPair
  }: {
    isLoaded: boolean,
    tokenPair: any
  }) => {
    const setIsCurrentUserLoaded = useSetAtomState(isCurrentUserLoadedState);
    const setTokenPair = useSetAtomState(tokenPairState);

    useEffect(() => {
      setIsCurrentUserLoaded(isLoaded);
      setTokenPair(tokenPair);
    }, [isLoaded, tokenPair, setIsCurrentUserLoaded, setTokenPair]);

    return null;
  };

  it('should show loader when auth state is not loaded', async () => {
    await act(async () => {
      render(
        <Provider>
          <StateInitializer isLoaded={false} tokenPair={null} />
          <MemoryRouter>
            <RequireAuth>
              <ProtectedContent />
            </RequireAuth>
          </MemoryRouter>
        </Provider>
      );
    });

    expect(screen.getByTestId('loader')).toBeInTheDocument();
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
  });

  it('should redirect to sign-in when user is not logged in', async () => {
    await act(async () => {
      render(
        <Provider>
          <StateInitializer isLoaded={true} tokenPair={null} />
          <MemoryRouter initialEntries={['/protected']}>
            <Routes>
              <Route
                path="/protected"
                element={
                  <RequireAuth>
                    <ProtectedContent />
                  </RequireAuth>
                }
              />
              <Route path={AppPath.SignInUp} element={<SignInPage />} />
            </Routes>
          </MemoryRouter>
        </Provider>
      );
    });

    expect(screen.getByTestId('signin')).toBeInTheDocument();
    expect(screen.queryByTestId('protected')).not.toBeInTheDocument();
  });

  it('should render children when user is logged in', async () => {
    await act(async () => {
      render(
        <Provider>
          <StateInitializer
            isLoaded={true}
            tokenPair={{
              accessOrWorkspaceAgnosticToken: { token: 'valid', expiresAt: '' },
              refreshToken: { token: '', expiresAt: '' }
            }}
          />
          <MemoryRouter>
            <RequireAuth>
              <ProtectedContent />
            </RequireAuth>
          </MemoryRouter>
        </Provider>
      );
    });

    expect(screen.getByTestId('protected')).toBeInTheDocument();
    expect(screen.queryByTestId('loader')).not.toBeInTheDocument();
  });
});
