import { useIsLogged } from '@/auth/hooks/useIsLogged';
import { isCurrentUserLoadedState } from '@/auth/states/isCurrentUserLoadedState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { Navigate, useLocation } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';
import { UserOrMetadataLoader } from '~/loading/components/UserOrMetadataLoader';

export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const isLoggedIn = useIsLogged();
  const isCurrentUserLoaded = useAtomStateValue(isCurrentUserLoadedState);
  const location = useLocation();

  if (!isCurrentUserLoaded) {
    return <UserOrMetadataLoader />;
  }

  if (!isLoggedIn) {
    return (
      <Navigate
        to={AppPath.SignInUp}
        state={{ from: location }}
        replace
      />
    );
  }

  return <>{children}</>;
};
