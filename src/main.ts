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
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    const app = await NestFactory.create<NestFastifyApplication>(
      AppModule,
      new FastifyAdapter({ logger: false, bodyLimit: 10 * 1024 * 1024 }),
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
      max: (req) => (req.url?.startsWith(`/${apiPrefix}/auth/`) ? 20 : 300),
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

    // ── Health check ───────────────────────────────────────────────────────
    const fastifyInstance = app.getHttpAdapter().getInstance();
    fastifyInstance.get('/health', async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      env: nodeEnv,
      version: '1.0.0',
    }));

    await app.listen(port, '0.0.0.0');
    console.log(`🌿 JadeXpress API running on port ${port} [${nodeEnv}]`);
    if (enableSwagger) {
      console.log(`📖 Swagger docs: http://localhost:${port}/docs`);
    }
  } catch (err) {
    console.error('❌ Failed to bootstrap application:', err);
    process.exit(1);
  }
}

bootstrap();