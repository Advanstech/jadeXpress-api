import { Controller, Get, Post, Body, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { z } from 'zod';
import { PushService } from './push.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CurrentUser, JwtPayload } from '../../common/decorators/current-user.decorator';

const SubscribeSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});
const UnsubscribeSchema = z.object({ endpoint: z.string().url().max(2048) });

@ApiTags('push')
@ApiBearerAuth()
@Controller('push')
export class PushController {
  constructor(private readonly push: PushService) {}

  @Get('public-key')
  @ApiOperation({ summary: 'VAPID public key for the browser to subscribe with' })
  publicKey() {
    return { enabled: this.push.isEnabled(), publicKey: this.push.publicKey };
  }

  @Post('subscribe')
  @ApiOperation({ summary: 'Register this browser for push notifications' })
  subscribe(
    @Body(new ZodValidationPipe(SubscribeSchema)) body: z.infer<typeof SubscribeSchema>,
    @CurrentUser() user: JwtPayload,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.push.subscribe(user, body, userAgent);
  }

  @Post('unsubscribe')
  @ApiOperation({ summary: 'Remove this browser from push notifications' })
  unsubscribe(
    @Body(new ZodValidationPipe(UnsubscribeSchema)) body: z.infer<typeof UnsubscribeSchema>,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.push.unsubscribe(user, body.endpoint);
  }
}
