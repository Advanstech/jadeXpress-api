import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { FastifyRequest } from 'fastify';
import { JwtPayload } from '../../../common/decorators/current-user.decorator';

/**
 * Authenticates storefront (e-commerce) customer sessions.
 *
 * Routes using this guard must also be marked @Public() so the global
 * staff JwtAuthGuard skips them — this guard then verifies the bearer
 * token itself and only accepts storefront-issued tokens
 * (type 'customer' or 'staff'), never POS staff tokens.
 */
@Injectable()
export class CustomerAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context
      .switchToHttp()
      .getRequest<FastifyRequest & { user?: JwtPayload }>();

    const header = req.headers?.authorization;
    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authentication required');
    }

    try {
      const payload = await this.jwtService.verifyAsync<JwtPayload>(
        header.slice(7),
      );
      if (!payload?.sub) throw new UnauthorizedException('Invalid token');
      if (payload.type !== 'customer' && payload.type !== 'staff') {
        throw new UnauthorizedException('Invalid token audience');
      }
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid or expired token');
    }
  }
}
