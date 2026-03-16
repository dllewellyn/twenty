import { useSnackBar } from '@/ui/feedback/snack-bar-manager/hooks/useSnackBar';
import { t } from '@lingui/core/macro';

export const useFirestoreErrorHandler = () => {
  const { enqueueErrorSnackBar } = useSnackBar();

  const handleError = (error: any) => {
    // We can assume error might be a FirestoreError which has a `code` property
    const code = error?.code;

    switch (code) {
      case 'permission-denied':
        enqueueErrorSnackBar({
          message: t`You don't have permission to perform this action. This might be restricted by ownership or role rules.`
        });
        break;
      case 'not-found':
        enqueueErrorSnackBar({
          message: t`The requested record was not found.`
        });
        break;
      case 'failed-precondition':
        enqueueErrorSnackBar({
          message: t`A required index is missing. Please contact support.`
        });
        break;
      default:
        // Handle generic errors or ignore if not specific
        const message = error?.message || t`An unexpected error occurred.`;
        enqueueErrorSnackBar({ message });
        break;
    }
  };

  return { handleError };
};
