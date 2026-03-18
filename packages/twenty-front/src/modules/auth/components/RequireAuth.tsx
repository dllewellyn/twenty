import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { AppPath } from 'twenty-shared/types';

import { useIsLogged } from '@/auth/hooks/useIsLogged';
import { useReturnToPath } from '@/auth/hooks/useReturnToPath';
import { isCurrentUserLoadedState } from '@/auth/states/isCurrentUserLoadedState';
import { useAtomStateValue } from '@/ui/utilities/state/jotai/hooks/useAtomStateValue';
import { UserOrMetadataLoader } from '~/loading/components/UserOrMetadataLoader';

export const RequireAuth = ({ children }: { children: React.ReactNode }) => {
  const isLoggedIn = useIsLogged();
  const isCurrentUserLoaded = useAtomStateValue(isCurrentUserLoadedState);
  const location = useLocation();
  const { saveReturnToPath } = useReturnToPath();

  useEffect(() => {
    if (!isLoggedIn && isCurrentUserLoaded) {
      saveReturnToPath(location.pathname + location.search);
    }
  }, [isLoggedIn, isCurrentUserLoaded, location, saveReturnToPath]);

  if (!isCurrentUserLoaded) {
    return <UserOrMetadataLoader />;
  }

  if (!isLoggedIn) {
    return (
      <Navigate
        to={AppPath.SignInUp}
        replace
      />
    );
  }

  return <>{children}</>;
};
