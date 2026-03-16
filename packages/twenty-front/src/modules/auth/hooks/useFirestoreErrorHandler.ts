import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';

export const useFirestoreErrorHandler = () => {
  const { enqueueSnackBar } = useSnackBar();

  const handleError = (error: any) => {
    // We can assume error might be a FirestoreError which has a `code` property
    const code = error?.code;

    switch (code) {
      case 'permission-denied':
        enqueueSnackBar(
          "You don't have permission to perform this action. This might be restricted by ownership or role rules.",
          { variant: 'error' }
        );
        break;
      case 'not-found':
        enqueueSnackBar(
          "The requested record was not found.",
          { variant: 'error' }
        );
        break;
      case 'failed-precondition':
        enqueueSnackBar(
          "A required index is missing. Please contact support.",
          { variant: 'error' }
        );
        break;
      default:
        // Handle generic errors or ignore if not specific
        const message = error?.message || 'An unexpected error occurred.';
        enqueueSnackBar(message, { variant: 'error' });
        break;
    }
  };

  return { handleError };
};
