import { Controller, Post, Put, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';
import {
  LoginSchema, LoginDto,
  PinLoginSchema, PinLoginDto,
  PinVerifySchema, PinVerifyDto,
  RefreshTokenSchema, RefreshTokenDto,
  ChangePinSchema, ChangePinDto,
} from './dto/auth.dto';
import {
  ForgotCredentialSchema, ForgotCredentialDto,
  ResetCredentialSchema, ResetCredentialDto,
} from './dto/auth-recovery.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Email + password login (manager/owner portal)' })
  login(@Body(new ZodValidationPipe(LoginSchema)) dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('pin-login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'PIN login — POS cashier touchscreen login' })
  pinLogin(@Body(new ZodValidationPipe(PinLoginSchema)) dto: PinLoginDto) {
    return this.authService.pinLogin(dto);
  }

  @Public()
  @Post('pin-verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify manager PIN for overrides (no token issued)' })
  verifyPin(@Body(new ZodValidationPipe(PinVerifySchema)) dto: PinVerifyDto) {
    return this.authService.verifyPin(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  refresh(@Body(new ZodValidationPipe(RefreshTokenSchema)) dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Revoke refresh token' })
  logout(@Body(new ZodValidationPipe(RefreshTokenSchema)) dto: RefreshTokenDto) {
    return this.authService.logout(dto.refreshToken);
  }

  @Put('change-pin')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user PIN' })
  changePin(
    @CurrentUser() user: JwtPayload,
    @Body(new ZodValidationPipe(ChangePinSchema)) dto: ChangePinDto,
  ) {
    return this.authService.changePin(user.sub, user.storeId, dto);
  }

  @Public()
  @Post('forgot-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request OTP to reset PIN' })
  forgotPin(@Body(new ZodValidationPipe(ForgotCredentialSchema)) dto: ForgotCredentialDto) {
    return this.authService.forgotCredential(dto.email, 'pin');
  }

  @Public()
  @Post('reset-pin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset PIN with OTP' })
  resetPin(@Body(new ZodValidationPipe(ResetCredentialSchema)) dto: ResetCredentialDto) {
    return this.authService.resetCredential(dto.email, dto.otpCode, dto.newSecret, 'pin');
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request OTP to reset Password' })
  forgotPassword(@Body(new ZodValidationPipe(ForgotCredentialSchema)) dto: ForgotCredentialDto) {
    return this.authService.forgotCredential(dto.email, 'password');
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset Password with OTP' })
  resetPassword(@Body(new ZodValidationPipe(ResetCredentialSchema)) dto: ResetCredentialDto) {
    return this.authService.resetCredential(dto.email, dto.otpCode, dto.newSecret, 'password');
  }
}
