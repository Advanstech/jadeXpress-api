import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import fastifyHelmet from '@fastify/helmet';
import fastifyCompress from '@fastify/compress';
import fastifyRateLimit from '@fastify/rate-limit';
import { sql } from 'drizzle-orm';
import { AppModule } from './app.module';
import { DRIZZLE } from './database/database.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({
        logger: false,
        bodyLimit: 10 * 1024 * 1024,
        // Behind Render/nginx — trust X-Forwarded-* so rate limiting sees real client IPs
        trustProxy: true,
        // Hard request timeout — no request may hang forever
        requestTimeout: 30_000,
        // Stay just above typical LB idle timeout (60s) to avoid premature resets
        keepAliveTimeout: 61_000,
      }),
    );

    const config = app.get(ConfigService);
    const port = config.getOrThrow<number>('app.port');
    const apiPrefix = config.getOrThrow<string>('app.apiPrefix');
    const corsOrigins = config.getOrThrow<string[]>('app.corsOrigins');
    const nodeEnv = config.getOrThrow<string>('app.nodeEnv');

    // ── Security ───────────────────────────────────────────────────────────
    await app.register(fastifyHelmet, {
      contentSecurityPolicy: nodeEnv === 'production',
    });

    // ── Compression ────────────────────────────────────────────────────────
    await app.register(fastifyCompress);

    // ── Rate limiting ──────────────────────────────────────────────────────
    await app.register(fastifyRateLimit, {
      max: (req) =>
        // Stricter buckets for auth (brute force) and AI (paid upstream calls)
        req.url?.startsWith(`/${apiPrefix}/auth/`) ||
        req.url?.startsWith(`/${apiPrefix}/ai/`)
          ? 20
          : 300,
      timeWindow: '1 minute',
      allowList: ['127.0.0.1'],
    });

    // NOTE: @fastify/multipart is intentionally NOT registered globally.
    // Registering it globally intercepts the request body before Fastify's
    // built-in JSON parser, breaking all JSON endpoints.
    // File upload routes register it locally via a scoped plugin instead.

    // ── CORS ───────────────────────────────────────────────────────────────
    app.enableCors({
      origin: nodeEnv === 'production' ? corsOrigins : (origin, cb) => cb(null, true),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    });

    // ── Global prefix ──────────────────────────────────────────────────────
    app.setGlobalPrefix(apiPrefix, {
      exclude: ['/health', '/'],
    });

    // ── Graceful shutdown ─────────────────────────────────────────────────
    // SIGTERM/SIGINT now run lifecycle hooks (DatabaseModule closes its pool)
    app.enableShutdownHooks();

    // ── OpenAPI / Swagger ──────────────────────────────────────────────────
    const enableSwagger =
      nodeEnv !== 'production' || process.env.SWAGGER_ENABLED === 'true';
    if (enableSwagger) {
      const swaggerConfig = new DocumentBuilder()
        .setTitle('JadeXpress POS API')
        .setDescription(
          'NestJS + Fastify + Drizzle + Neon — JadeXpress POS for jadexpressgh.com',
        )
        .setVersion('1.0')
        .addBearerAuth()
        .addTag('auth', 'PIN & password authentication')
        .addTag('staff', 'Staff management & shifts')
        .addTag('inventory', 'Products, stock, batches, alerts')
        .addTag('sales', 'POS sales with Ghana tax & loyalty')
        .addTag('customers', 'Customer profiles & loyalty')
        .addTag('suppliers', 'Supplier management & purchase orders')
        .addTag('expenses', 'Expense tracking with ledger')
        .addTag('refunds', 'Refund requests & restock')
        .addTag('eod', 'End-of-day cash reconciliation')
        .addTag('accounting', 'P&L, ledger, tax reports')
        .addTag('stock-intelligence', 'AI-powered reorder & forecast (mocked)')
        .addTag('reporting', 'Sales KPIs & analytics')
        .addTag('dashboard', 'Live dashboard & sparklines')
        .addTag('ai', 'AI endpoints — pending model integration')
        .build();

      const document = SwaggerModule.createDocument(app, swaggerConfig);
      SwaggerModule.setup('docs', app, document, {
        swaggerOptions: { persistAuthorization: true },
      });
    }

    // ── Health checks ──────────────────────────────────────────────────────
    // /health        → liveness (no dependencies — for LB uptime pings)
    // /health/ready  → readiness (verifies DB connectivity — for deploy gates)
    const fastifyInstance = app.getHttpAdapter().getInstance();
    fastifyInstance.get('/health', async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: nodeEnv,
      version: '1.0.0',
    }));

    const db = app.get(DRIZZLE);
    fastifyInstance.get('/health/ready', async (_req: unknown, reply: unknown) => {
      try {
        await db.execute(sql`select 1`);
        return { status: 'ok', db: 'up', timestamp: new Date().toISOString() };
      } catch {
        (reply as { code: (n: number) => void }).code(503);
        return { status: 'error', db: 'down', timestamp: new Date().toISOString() };
      }
    });

    await app.listen(port, '0.0.0.0');
    console.log(`🌿 JadeXpress API running on port ${port} [${nodeEnv}]`);
    if (enableSwagger) {
      console.log(`📖 Swagger docs: http://localhost:${port}/docs`);
    }

    // ── Process-level resilience ───────────────────────────────────────────
    // Log stray promise rejections but keep serving (a single rejection
    // should never take the whole POS backend down).
    process.on('unhandledRejection', (reason) => {
      console.error('❌ Unhandled promise rejection:', reason);
    });
    // An uncaught exception leaves the process in an undefined state —
    // log and exit so the platform restarts a clean instance.
    process.on('uncaughtException', (err) => {
      console.error('❌ Uncaught exception — exiting for clean restart:', err);
      process.exit(1);
    });
    // Safety net: if graceful shutdown (via enableShutdownHooks) ever hangs,
    // force-exit after 10s so deploys don't wedge.
    const forceExitTimer = (signal: string) => {
      console.log(`👋 ${signal} received — shutting down gracefully`);
      setTimeout(() => {
        console.error('⚠️ Graceful shutdown exceeded 10s — forcing exit');
        process.exit(0);
      }, 10_000).unref();
    };
    process.on('SIGTERM', () => forceExitTimer('SIGTERM'));
    process.on('SIGINT', () => forceExitTimer('SIGINT'));
  } catch (err) {
    console.error('❌ Failed to bootstrap application:', err);
    process.exit(1);
  }
}

bootstrap();