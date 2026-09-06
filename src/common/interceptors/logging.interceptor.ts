import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { FastifyRequest } from 'fastify';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const { method, url } = req;
    const start = Date.now();

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start;
          if (ms > 1000) {
            this.logger.warn(`SLOW ${method} ${url} — ${ms}ms`);
          } else {
            this.logger.log(`${method} ${url} — ${ms}ms`);
          }
        },
        error: () => {
          const ms = Date.now() - start;
          this.logger.warn(`${method} ${url} — failed after ${ms}ms`);
        },
      }),
    );
  }
}
