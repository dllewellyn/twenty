import { UseFilters, UseGuards, UsePipes } from '@nestjs/common';
import { Args, Context, Mutation, Query } from '@nestjs/graphql';
import { InjectRepository } from '@nestjs/typeorm';

import omit from 'lodash.omit';
import { PermissionFlagType } from 'twenty-shared/constants';
import { SOURCE_LOCALE } from 'twenty-shared/translations';
import { TwoFactorAuthenticationStrategy } from 'twenty-shared/types';
import { assertIsDefinedOrThrow, isDefined } from 'twenty-shared/utils';
import { Repository } from 'typeorm';

import { MetadataResolver } from 'src/engine/api/graphql/graphql-config/decorators/metadata-resolver.decorator';
import { ApiKeyService } from 'src/engine/core-modules/api-key/services/api-key.service';
import { AppTokenEntity } from 'src/engine/core-modules/app-token/app-token.entity';
import { AuditService } from 'src/engine/core-modules/audit/services/audit.service';
import { MONITORING_EVENT } from 'src/engine/core-modules/audit/utils/events/workspace-event/monitoring/monitoring';
import {
  AuthException,
  AuthExceptionCode,
} from 'src/engine/core-modules/auth/auth.exception';
import { ApiKeyTokenInput } from 'src/engine/core-modules/auth/dto/api-key-token.input';
import { AppTokenInput } from 'src/engine/core-modules/auth/dto/app-token.input';
import { AuthorizeAppDTO } from 'src/engine/core-modules/auth/dto/authorize-app.dto';
import { AuthorizeAppInput } from 'src/engine/core-modules/auth/dto/authorize-app.input';
import { AvailableWorkspacesAndAccessTokensDTO } from 'src/engine/core-modules/auth/dto/available-workspaces-and-access-tokens.dto';
import { EmailPasswordResetLinkDTO } from 'src/engine/core-modules/auth/dto/email-password-reset-link.dto';
import { EmailPasswordResetLinkInput } from 'src/engine/core-modules/auth/dto/email-password-reset-link.input';
import { GetAuthTokenFromEmailVerificationTokenInput } from 'src/engine/core-modules/auth/dto/get-auth-token-from-email-verification-token.input';
import { GetAuthorizationUrlForSSODTO } from 'src/engine/core-modules/auth/dto/get-authorization-url-for-sso.dto';
import { GetAuthorizationUrlForSSOInput } from 'src/engine/core-modules/auth/dto/get-authorization-url-for-sso.input';
import { InvalidatePasswordDTO } from 'src/engine/core-modules/auth/dto/invalidate-password.dto';
import { SignUpDTO } from 'src/engine/core-modules/auth/dto/sign-up.dto';
import { TransientTokenDTO } from 'src/engine/core-modules/auth/dto/transient-token.dto';
import { UpdatePasswordViaResetTokenInput } from 'src/engine/core-modules/auth/dto/update-password-via-reset-token.input';
import { ValidatePasswordResetTokenDTO } from 'src/engine/core-modules/auth/dto/validate-password-reset-token.dto';
import { ValidatePasswordResetTokenInput } from 'src/engine/core-modules/auth/dto/validate-password-reset-token.input';
import { VerifyEmailAndGetLoginTokenDTO } from 'src/engine/core-modules/auth/dto/verify-email-and-get-login-token.dto';
import { AuthGraphqlApiExceptionFilter } from 'src/engine/core-modules/auth/filters/auth-graphql-api-exception.filter';
import { ResetPasswordService } from 'src/engine/core-modules/auth/services/reset-password.service';
import { SignInUpService } from 'src/engine/core-modules/auth/services/sign-in-up.service';
import { EmailVerificationTokenService } from 'src/engine/core-modules/auth/token/services/email-verification-token.service';
import { TransientTokenService } from 'src/engine/core-modules/auth/token/services/transient-token.service';
import {
  AuthContextUser,
  LoginTokenJwtPayload,
} from 'src/engine/core-modules/auth/types/auth-context.type';
import { CaptchaGuard } from 'src/engine/core-modules/captcha/captcha.guard';
import { CaptchaGraphqlApiExceptionFilter } from 'src/engine/core-modules/captcha/filters/captcha-graphql-api-exception.filter';
import { WorkspaceDomainsService } from 'src/engine/core-modules/domain/workspace-domains/services/workspace-domains.service';
import { EmailVerificationExceptionFilter } from 'src/engine/core-modules/email-verification/email-verification-exception-filter.util';
import { EmailVerificationTrigger } from 'src/engine/core-modules/email-verification/email-verification.constants';
import { EmailVerificationService } from 'src/engine/core-modules/email-verification/services/email-verification.service';
import { PreventNestToAutoLogGraphqlErrorsFilter } from 'src/engine/core-modules/graphql/filters/prevent-nest-to-auto-log-graphql-errors.filter';
import { ResolverValidationPipe } from 'src/engine/core-modules/graphql/pipes/resolver-validation.pipe';
import { I18nContext } from 'src/engine/core-modules/i18n/types/i18n-context.type';
import { SSOService } from 'src/engine/core-modules/sso/services/sso.service';
import { TwoFactorAuthenticationVerificationInput } from 'src/engine/core-modules/two-factor-authentication/dto/two-factor-authentication-verification.input';
import { TwoFactorAuthenticationExceptionFilter } from 'src/engine/core-modules/two-factor-authentication/two-factor-authentication-exception.filter';
import { TwoFactorAuthenticationService } from 'src/engine/core-modules/two-factor-authentication/two-factor-authentication.service';
import { UserWorkspaceEntity } from 'src/engine/core-modules/user-workspace/user-workspace.entity';
import { UserWorkspaceService } from 'src/engine/core-modules/user-workspace/user-workspace.service';
import { UserService } from 'src/engine/core-modules/user/services/user.service';
import { UserEntity } from 'src/engine/core-modules/user/user.entity';
import { AuthProviderEnum } from 'src/engine/core-modules/workspace/types/workspace.type';
import { WorkspaceEntity } from 'src/engine/core-modules/workspace/workspace.entity';
import { AuthProvider } from 'src/engine/decorators/auth/auth-provider.decorator';
import { AuthUser } from 'src/engine/decorators/auth/auth-user.decorator';
import { AuthWorkspace } from 'src/engine/decorators/auth/auth-workspace.decorator';
import { NoPermissionGuard } from 'src/engine/guards/no-permission.guard';
import { PublicEndpointGuard } from 'src/engine/guards/public-endpoint.guard';
import { SettingsPermissionGuard } from 'src/engine/guards/settings-permission.guard';
import { UserAuthGuard } from 'src/engine/guards/user-auth.guard';
import { WorkspaceAuthGuard } from 'src/engine/guards/workspace-auth.guard';
import { PermissionsService } from 'src/engine/metadata-modules/permissions/permissions.service';
import { PermissionsGraphqlApiExceptionFilter } from 'src/engine/metadata-modules/permissions/utils/permissions-graphql-api-exception.filter';

import { ApiKeyToken } from './dto/api-key-token.dto';
import { AuthTokens } from './dto/auth-tokens.dto';
import { GetAuthTokensFromLoginTokenInput } from './dto/get-auth-tokens-from-login-token.input';
import { LoginTokenDTO } from './dto/login-token.dto';
import { SignUpInput } from './dto/sign-up.input';
import { UserCredentialsInput } from './dto/user-credentials.input';
import { CheckUserExistDTO } from './dto/user-exists.dto';
import { EmailAndCaptchaInput } from './dto/user-exists.input';
import { WorkspaceInviteHashValidDTO } from './dto/workspace-invite-hash-valid.dto';
import { WorkspaceInviteHashValidInput } from './dto/workspace-invite-hash.input';
import { AuthService } from './services/auth.service';

@UsePipes(ResolverValidationPipe)
@MetadataResolver()
@UseFilters(
  CaptchaGraphqlApiExceptionFilter,
  AuthGraphqlApiExceptionFilter,
  PermissionsGraphqlApiExceptionFilter,
  EmailVerificationExceptionFilter,
  TwoFactorAuthenticationExceptionFilter,
  PreventNestToAutoLogGraphqlErrorsFilter,
)
export class AuthResolver {
  constructor(
    @InjectRepository(UserWorkspaceEntity)
    private readonly userWorkspaceRepository: Repository<UserWorkspaceEntity>,
    @InjectRepository(AppTokenEntity)
    private readonly appTokenRepository: Repository<AppTokenEntity>,
    private readonly twoFactorAuthenticationService: TwoFactorAuthenticationService,
    private authService: AuthService,
    private userService: UserService,
    private apiKeyService: ApiKeyService,
    private resetPasswordService: ResetPasswordService,
    private signInUpService: SignInUpService,
    private transientTokenService: TransientTokenService,
    private emailVerificationService: EmailVerificationService,
    private workspaceDomainsService: WorkspaceDomainsService,
    private userWorkspaceService: UserWorkspaceService,
    private emailVerificationTokenService: EmailVerificationTokenService,
    private sSOService: SSOService,
    private readonly auditService: AuditService,
    private readonly permissionsService: PermissionsService,
  ) {}

  @UseGuards(CaptchaGuard, PublicEndpointGuard, NoPermissionGuard)
  @Query(() => CheckUserExistDTO)
  async checkUserExists(
    @Args() checkUserExistsInput: EmailAndCaptchaInput,
  ): Promise<CheckUserExistDTO> {
    return await this.authService.checkUserExists(
      checkUserExistsInput.email.toLowerCase(),
    );
  }

  @Mutation(() => GetAuthorizationUrlForSSODTO)
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async getAuthorizationUrlForSSO(
    @Args('input') params: GetAuthorizationUrlForSSOInput,
  ) {
    return await this.sSOService.getAuthorizationUrlForSSO(
      params.identityProviderId,
      omit(params, ['identityProviderId']),
    );
  }

  @Query(() => WorkspaceInviteHashValidDTO)
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async checkWorkspaceInviteHashIsValid(
    @Args() workspaceInviteHashValidInput: WorkspaceInviteHashValidInput,
  ): Promise<WorkspaceInviteHashValidDTO> {
    return await this.authService.checkWorkspaceInviteHashIsValid(
      workspaceInviteHashValidInput.inviteHash,
    );
  }

  @Query(() => WorkspaceEntity)
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async findWorkspaceFromInviteHash(
    @Args() workspaceInviteHashValidInput: WorkspaceInviteHashValidInput,
  ): Promise<WorkspaceEntity> {
    return await this.authService.findWorkspaceFromInviteHashOrFail(
      workspaceInviteHashValidInput.inviteHash,
    );
  }

  @Mutation(() => LoginTokenDTO)
  @UseGuards(CaptchaGuard, PublicEndpointGuard, NoPermissionGuard)
  async getLoginTokenFromCredentials(
    @Args()
    getLoginTokenFromCredentialsInput: UserCredentialsInput,
    @Args('origin') origin: string,
  ): Promise<LoginTokenDTO> {
    return { loginToken: { token: '', expiresAt: new Date() } };
  }

  @Mutation(() => AvailableWorkspacesAndAccessTokensDTO)
  @UseGuards(CaptchaGuard, PublicEndpointGuard, NoPermissionGuard)
  async signIn(
    @Args()
    userCredentials: UserCredentialsInput,
  ): Promise<AvailableWorkspacesAndAccessTokensDTO> {
    return {
      availableWorkspaces: [],
      tokens: {
        accessOrWorkspaceAgnosticToken: { token: '', expiresAt: new Date() },
        refreshToken: { token: '', expiresAt: new Date() },
      },
    } as any;
  }

  @Mutation(() => VerifyEmailAndGetLoginTokenDTO)
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async verifyEmailAndGetLoginToken(
    @Args()
    getAuthTokenFromEmailVerificationTokenInput: GetAuthTokenFromEmailVerificationTokenInput,
    @Args('origin') origin: string,
    @AuthProvider() authProvider: AuthProviderEnum,
  ) {
    return {
      loginToken: { token: '', expiresAt: new Date() },
      workspaceUrls: { customUrl: '', appUrl: '' },
    };
  }

  @Mutation(() => AvailableWorkspacesAndAccessTokensDTO)
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async verifyEmailAndGetWorkspaceAgnosticToken(
    @Args()
    getAuthTokenFromEmailVerificationTokenInput: GetAuthTokenFromEmailVerificationTokenInput,
    @AuthProvider() authProvider: AuthProviderEnum,
  ) {
    return {
      availableWorkspaces: [],
      tokens: {
        accessOrWorkspaceAgnosticToken: { token: '', expiresAt: new Date() },
        refreshToken: { token: '', expiresAt: new Date() },
      },
    } as any;
  }

  @Mutation(() => AuthTokens)
  @UseGuards(CaptchaGuard, PublicEndpointGuard, NoPermissionGuard)
  async getAuthTokensFromOTP(
    @Args()
    twoFactorAuthenticationVerificationInput: TwoFactorAuthenticationVerificationInput,
    @Args('origin') origin: string,
  ): Promise<AuthTokens> {
    return {
      tokens: {
        accessOrWorkspaceAgnosticToken: { token: '', expiresAt: new Date() },
        refreshToken: { token: '', expiresAt: new Date() },
      },
    };
  }

  @Mutation(() => AvailableWorkspacesAndAccessTokensDTO)
  @UseGuards(CaptchaGuard, PublicEndpointGuard, NoPermissionGuard)
  async signUp(
    @Args() signUpInput: UserCredentialsInput,
  ): Promise<AvailableWorkspacesAndAccessTokensDTO> {
    return {
      availableWorkspaces: [],
      tokens: {
        accessOrWorkspaceAgnosticToken: { token: '', expiresAt: new Date() },
        refreshToken: { token: '', expiresAt: new Date() },
      },
    } as any;
  }

  @Mutation(() => SignUpDTO)
  @UseGuards(CaptchaGuard, PublicEndpointGuard, NoPermissionGuard)
  async signUpInWorkspace(
    @Args() signUpInput: SignUpInput,
    @AuthProvider() authProvider: AuthProviderEnum,
  ): Promise<SignUpDTO> {
    return {
      loginToken: { token: '', expiresAt: new Date() },
      workspace: {
        id: '',
        workspaceUrls: { customUrl: '', appUrl: '' },
      },
    };
  }

  @Mutation(() => SignUpDTO)
  @UseGuards(UserAuthGuard, NoPermissionGuard)
  async signUpInNewWorkspace(
    @AuthUser() currentUser: AuthContextUser,
    @AuthProvider() authProvider: AuthProviderEnum,
  ): Promise<SignUpDTO> {
    return {
      loginToken: { token: '', expiresAt: new Date() },
      workspace: {
        id: '',
        workspaceUrls: { customUrl: '', appUrl: '' },
      },
    };
  }

  @Mutation(() => TransientTokenDTO)
  @UseGuards(UserAuthGuard, NoPermissionGuard)
  async generateTransientToken(
    @AuthUser() user: AuthContextUser,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<TransientTokenDTO | void> {
    const workspaceMember = await this.userService.loadWorkspaceMember(
      user,
      workspace,
    );

    if (!workspaceMember) {
      return;
    }
    const transientToken =
      await this.transientTokenService.generateTransientToken({
        workspaceId: workspace.id,
        userId: user.id,
        workspaceMemberId: workspaceMember.id,
      });

    return { transientToken };
  }

  @Mutation(() => AuthTokens)
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async getAuthTokensFromLoginToken(
    @Args() getAuthTokensFromLoginTokenInput: GetAuthTokensFromLoginTokenInput,
    @Args('origin') origin: string,
  ): Promise<AuthTokens> {
    return {
      tokens: {
        accessOrWorkspaceAgnosticToken: { token: '', expiresAt: new Date() },
        refreshToken: { token: '', expiresAt: new Date() },
      },
    };
  }

  @Mutation(() => AuthorizeAppDTO)
  @UseGuards(UserAuthGuard, NoPermissionGuard)
  async authorizeApp(
    @Args() authorizeAppInput: AuthorizeAppInput,
    @AuthUser() user: AuthContextUser,
    @AuthWorkspace() workspace: WorkspaceEntity,
  ): Promise<AuthorizeAppDTO> {
    return await this.authService.generateAuthorizationCode(
      authorizeAppInput,
      user,
      workspace,
    );
  }

  @Mutation(() => AuthTokens)
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async renewToken(@Args() args: AppTokenInput): Promise<AuthTokens> {
    return {
      tokens: {
        accessOrWorkspaceAgnosticToken: { token: '', expiresAt: new Date() },
        refreshToken: { token: '', expiresAt: new Date() },
      },
    };
  }

  @UseGuards(
    WorkspaceAuthGuard,
    SettingsPermissionGuard(PermissionFlagType.API_KEYS_AND_WEBHOOKS),
  )
  @Mutation(() => ApiKeyToken)
  async generateApiKeyToken(
    @Args() args: ApiKeyTokenInput,
    @AuthWorkspace() { id: workspaceId }: WorkspaceEntity,
  ): Promise<ApiKeyToken | undefined> {
    return await this.apiKeyService.generateApiKeyToken(
      workspaceId,
      args.apiKeyId,
      args.expiresAt,
    );
  }

  @Mutation(() => EmailPasswordResetLinkDTO)
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async emailPasswordResetLink(
    @Args() emailPasswordResetInput: EmailPasswordResetLinkInput,
    @Context() context: I18nContext,
  ): Promise<EmailPasswordResetLinkDTO> {
    const resetToken =
      await this.resetPasswordService.generatePasswordResetToken(
        emailPasswordResetInput.email,
        emailPasswordResetInput.workspaceId,
      );

    return await this.resetPasswordService.sendEmailPasswordResetLink({
      resetToken,
      email: emailPasswordResetInput.email,
      locale: context.req.locale,
    });
  }

  @Mutation(() => InvalidatePasswordDTO)
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async updatePasswordViaResetToken(
    @Args()
    { passwordResetToken, newPassword }: UpdatePasswordViaResetTokenInput,
  ): Promise<InvalidatePasswordDTO> {
    const { id } =
      await this.resetPasswordService.validatePasswordResetToken(
        passwordResetToken,
      );

    await this.authService.updatePassword(id, newPassword);

    return await this.resetPasswordService.invalidatePasswordResetToken(id);
  }

  @Query(() => ValidatePasswordResetTokenDTO)
  @UseGuards(PublicEndpointGuard, NoPermissionGuard)
  async validatePasswordResetToken(
    @Args() args: ValidatePasswordResetTokenInput,
  ): Promise<ValidatePasswordResetTokenDTO> {
    return this.resetPasswordService.validatePasswordResetToken(
      args.passwordResetToken,
    );
  }
}
