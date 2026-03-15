import {
  ApolloClient,
  type ApolloClientOptions,
  ApolloLink,
  type FetchResult,
  fromPromise,
  type Observable,
  type Operation,
  type ServerError,
  type ServerParseError,
} from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { RetryLink } from '@apollo/client/link/retry';
import { RestLink } from 'apollo-link-rest';
import { createUploadLink } from 'apollo-upload-client';

import { type CurrentWorkspaceMember } from '@/auth/states/currentWorkspaceMemberState';
import { type CurrentWorkspace } from '@/auth/states/currentWorkspaceState';
import { type AuthTokenPair } from '~/generated-metadata/graphql';
import { logDebug } from '~/utils/logDebug';

import { REST_API_BASE_URL } from '@/apollo/constant/rest-api-base-url';
import { type ApolloManager } from '@/apollo/types/apolloManager.interface';
import { getTokenPair } from '@/apollo/utils/getTokenPair';
import { loggerLink } from '@/apollo/utils/loggerLink';
import { StreamingRestLink } from '@/apollo/utils/streamingRestLink';
import { i18n } from '@lingui/core';
import { t } from '@lingui/core/macro';
import {
  type DefinitionNode,
  type DirectiveNode,
  type GraphQLFormattedError,
  type SelectionNode,
} from 'graphql';
import isEmpty from 'lodash.isempty';
import { getGenericOperationName, isDefined } from 'twenty-shared/utils';
import { cookieStorage } from '~/utils/cookie-storage';
import { auth } from '~/modules/auth/firebase';

const logger = loggerLink(() => 'Twenty');

// Shared across all ApolloFactory instances so concurrent
// UNAUTHENTICATED errors from /graphql and /metadata clients
// deduplicate into a single renewal request.
let renewalPromise: Promise<void> | null = null;

export interface Options<TCacheShape> extends ApolloClientOptions<TCacheShape> {
  onError?: (err: readonly GraphQLFormattedError[] | undefined) => void;
  onNetworkError?: (err: Error | ServerParseError | ServerError) => void;
  onTokenPairChange?: (tokenPair: AuthTokenPair) => void;
  onUnauthenticatedError?: () => void;
  onAppVersionMismatch?: (message: string) => void;
  onPayloadTooLarge?: (message: string) => void;
  onForbiddenError?: (message: string) => void;
  currentWorkspaceMember: CurrentWorkspaceMember | null;
  currentWorkspace: CurrentWorkspace | null;
  extraLinks?: ApolloLink[];
  isDebugMode?: boolean;
  appVersion?: string;
}

export class ApolloFactory<TCacheShape> implements ApolloManager<TCacheShape> {
  private client: ApolloClient<TCacheShape>;
  private currentWorkspaceMember: CurrentWorkspaceMember | null = null;
  private currentWorkspace: CurrentWorkspace | null = null;
  private appVersion?: string;

  constructor(opts: Options<TCacheShape>) {
    const {
      uri,
      onError: onErrorCb,
      onNetworkError,
      onTokenPairChange,
      onUnauthenticatedError,
      onAppVersionMismatch,
      onPayloadTooLarge,
      onForbiddenError,
      currentWorkspaceMember,
      currentWorkspace,
      extraLinks,
      isDebugMode,
      appVersion,
      ...options
    } = opts;

    this.currentWorkspaceMember = currentWorkspaceMember;
    this.currentWorkspace = currentWorkspace;
    this.appVersion = appVersion;

    const buildApolloLink = (): ApolloLink => {
      const uploadLink = createUploadLink({
        uri,
      });

      const streamingRestLink = new StreamingRestLink({
        uri: REST_API_BASE_URL,
      });

      const restLink = new RestLink({
        uri: REST_API_BASE_URL,
      });

      const authLink = setContext(async (_, { headers }) => {
        let token: string | undefined;

        if (auth.currentUser?.getIdToken) {
          try {
            token = await auth.currentUser.getIdToken();
          } catch (e) {
            // oxlint-disable-next-line no-console
            console.error('Failed to get Firebase ID token', e);
          }
        }

        if (!token) {
          const tokenPair = getTokenPair();
          token = tokenPair?.accessOrWorkspaceAgnosticToken?.token;
        }

        const locale = this.currentWorkspaceMember?.locale ?? i18n.locale;

        return {
          headers: {
            ...headers,
            ...options.headers,
            ...(token ? { authorization: `Bearer ${token}` } : {}),
            'x-locale': locale,
            ...(this.currentWorkspace?.metadataVersion && {
              'X-Schema-Version': `${this.currentWorkspace.metadataVersion}`,
            }),
            ...(this.appVersion && { 'X-App-Version': this.appVersion }),
          },
        };
      });

      const retryLink = new RetryLink({
        delay: {
          initial: 3000,
        },
        attempts: {
          max: 2,
          retryIf: (error) => {
            // oxlint-disable-next-line no-console
            console.log('retryIf error from retryLink', error);
            if (this.isAuthenticationError(error)) {
              return false;
            }
            if (this.isPayloadTooLargeError(error)) {
              return false;
            }
            return Boolean(error);
          },
        },
      });

      const handleTokenRenewal = (
        operation: Operation,
        forward: (operation: Operation) => Observable<FetchResult>,
      ) => {
        if (!renewalPromise) {
          renewalPromise = (async () => {
            if (!auth.currentUser?.getIdToken) {
              throw new Error('No Firebase user available for token renewal');
            }

            const token = await auth.currentUser.getIdToken(true);
            if (!token) {
              throw new Error('Failed to retrieve refreshed token');
            }

            const tokens: AuthTokenPair = {
              accessOrWorkspaceAgnosticToken: { token, expiresAt: '' },
              refreshToken: { token: '', expiresAt: '' },
            };

            // oxlint-disable-next-line no-console
            console.log('setTokenPair from handleTokenRenewal');
            onTokenPairChange?.(tokens);
            cookieStorage.setItem('tokenPair', JSON.stringify(tokens));
          })()
            .catch((error) => {
              // oxlint-disable-next-line no-console
              console.log(
                'Failed to renew token, triggering unauthenticated error from handleTokenRenewal',
                error,
              );
              onUnauthenticatedError?.();
            })
            .finally(() => {
              renewalPromise = null;
            });
        }

        return fromPromise(renewalPromise).flatMap(() => forward(operation));
      };

      const sendToSentry = ({
        graphQLError,
        operation,
      }: {
        graphQLError: GraphQLFormattedError;
        operation: Operation;
      }) => {
        if (isDebugMode === true) {
          logDebug(
            `[GraphQL error]: Message: ${graphQLError.message}, Location: ${
              graphQLError.locations
                ? JSON.stringify(graphQLError.locations)
                : graphQLError.locations
            }, Path: ${graphQLError.path}`,
          );
        }
        import('@sentry/react')
          .then(({ captureException, withScope }) => {
            withScope((scope) => {
              const error = new Error(graphQLError.message);

              error.name = graphQLError.message;

              const fingerPrint: string[] = [];
              if (isDefined(graphQLError.extensions)) {
                scope.setExtra('extensions', graphQLError.extensions);
                if (isDefined(graphQLError.extensions.subCode)) {
                  fingerPrint.push(graphQLError.extensions.subCode as string);
                }
              }

              if (isDefined(operation.operationName)) {
                scope.setExtra('operation', operation.operationName);
                const genericOperationName = getGenericOperationName(
                  operation.operationName,
                );

                if (isDefined(genericOperationName)) {
                  fingerPrint.push(genericOperationName);
                }
              }

              if (!isEmpty(fingerPrint)) {
                scope.setFingerprint(fingerPrint);
              }

              captureException(error); // Sentry expects a JS error
            });
          })
          .catch((sentryError) => {
            // oxlint-disable-next-line no-console
            console.error(
              'Failed to capture GraphQL error with Sentry:',
              sentryError,
            );
          });
      };

      const errorLink = onError(
        ({ graphQLErrors, networkError, forward, operation }) => {
          if (isDefined(graphQLErrors)) {
            onErrorCb?.(graphQLErrors);
            for (const graphQLError of graphQLErrors) {
              if (graphQLError.message === 'Unauthorized') {
                // oxlint-disable-next-line no-console
                console.log('Unauthorized, triggering token renewal');
                return handleTokenRenewal(operation, forward);
              }

              switch (graphQLError?.extensions?.code) {
                case 'APP_VERSION_MISMATCH': {
                  onAppVersionMismatch?.(
                    (graphQLError.extensions?.userFriendlyMessage as string) ||
                      t`Your app version is out of date. Please refresh the page.`,
                  );
                  return;
                }
                case 'UNAUTHENTICATED': {
                  // oxlint-disable-next-line no-console
                  console.log('UNAUTHENTICATED, triggering token renewal');
                  return handleTokenRenewal(operation, forward);
                }
                case 'NOT_FOUND':
                case 'BAD_USER_INPUT':
                case 'CONFLICT':
                  return;
                case 'FORBIDDEN': {
                  let message = t`You don't have permission to perform this action.`;
                  const userFriendlyMessage =
                    graphQLError.extensions?.userFriendlyMessage;
                  if (typeof userFriendlyMessage === 'string') {
                    message = userFriendlyMessage;
                  } else if (
                    userFriendlyMessage &&
                    typeof userFriendlyMessage === 'object' &&
                    'message' in userFriendlyMessage
                  ) {
                    message = String(
                      (userFriendlyMessage as { message: unknown }).message,
                    );
                  }
                  onForbiddenError?.(message);
                  return;
                }
                case 'METADATA_VALIDATION_FAILED': {
                  return;
                }
                case 'USER_INPUT_ERROR': {
                  if (graphQLError.extensions?.isExpected === true) {
                    return;
                  }
                  sendToSentry({ graphQLError, operation });
                  return;
                }
                case 'INTERNAL_SERVER_ERROR': {
                  return; // already caught in BE
                }
                default:
                  sendToSentry({ graphQLError, operation });
              }
            }
          }

          if (isDefined(networkError)) {
            if (
              this.isRestOperation(operation) &&
              this.isAuthenticationError(networkError as ServerError)
            ) {
              // oxlint-disable-next-line no-console
              console.log(
                'Authentication error, triggering token renewal from errorLink',
              );
              return handleTokenRenewal(operation, forward);
            }

            if (this.isPayloadTooLargeError(networkError as ServerError)) {
              onPayloadTooLarge?.(t`Uploaded content is too large.`);
              return;
            }

            if ((networkError as ServerError).statusCode === 403) {
              onForbiddenError?.(
                t`You don't have permission to perform this action.`,
              );
              return;
            }

            if (isDebugMode === true) {
              logDebug(`[Network error]: ${networkError}`);
            }
            onNetworkError?.(networkError);
          }
        },
      );

      return ApolloLink.from(
        [
          errorLink,
          authLink,
          ...(extraLinks || []),
          isDebugMode ? logger : null,
          retryLink,
          streamingRestLink,
          restLink,
          uploadLink,
        ].filter(isDefined),
      );
    };

    this.client = new ApolloClient({
      ...options,
      link: buildApolloLink(),
    });
  }

  private isRestOperation(operation: Operation): boolean {
    return operation.query.definitions.some(
      (def: DefinitionNode) =>
        def.kind === 'OperationDefinition' &&
        def.selectionSet?.selections.some(
          (selection: SelectionNode) =>
            selection.kind === 'Field' &&
            selection.directives?.some(
              (directive: DirectiveNode) =>
                directive.name.value === 'rest' ||
                directive.name.value === 'stream',
            ),
        ),
    );
  }

  private isAuthenticationError(error: ServerError): boolean {
    return error.statusCode === 401;
  }

  private isPayloadTooLargeError(error: ServerError): boolean {
    return error.statusCode === 413;
  }

  updateWorkspaceMember(workspaceMember: CurrentWorkspaceMember | null) {
    this.currentWorkspaceMember = workspaceMember;
  }

  updateCurrentWorkspace(workspace: CurrentWorkspace | null) {
    this.currentWorkspace = workspace;
  }

  updateAppVersion(appVersion?: string) {
    this.appVersion = appVersion;
  }

  getClient() {
    return this.client;
  }
}
