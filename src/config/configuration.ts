export default () => ({
  app: {
    nodeEnv: process.env.NODE_ENV ?? 'development',
    port: parseInt(process.env.PORT ?? '3001', 10),
    apiPrefix: process.env.API_PREFIX ?? 'api/v1',
    corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000,http://localhost:3002').split(','),
  },
  database: {
    url: process.env.DATABASE_URL!,
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN ?? '15m',
    refreshSecret: process.env.JWT_REFRESH_SECRET!,
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '7d',
  },
  tax: {
    vatRateBps: parseInt(process.env.VAT_RATE_BPS ?? process.env.VAT_RATE ?? '1500', 10),
    nhilRateBps: parseInt(process.env.NHIL_RATE_BPS ?? process.env.NHIL_RATE ?? '250', 10),
    getfundRateBps: parseInt(process.env.GETFUND_RATE_BPS ?? process.env.GETFUND_RATE ?? '250', 10),
  },
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    geminiApiKey: process.env.GEMINI_API_KEY,
    model: process.env.AI_MODEL ?? 'gpt-4o-mini',
  },
  upload: {
    maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB ?? '10', 10),
  },
  payments: {
    paystackSecretKey: process.env.PAYSTACK_SECRET_KEY,
    paystackPublicKey: process.env.PAYSTACK_PUBLIC_KEY,
    paystackCallbackUrl: process.env.PAYSTACK_CALLBACK_URL,
    momoApiUser: process.env.MOMO_API_USER,
    momoApiKey: process.env.MOMO_API_KEY,
    momoSubscriptionKey: process.env.MOMO_SUBSCRIPTION_KEY,
    momoBaseUrl:
      process.env.MOMO_BASE_URL ?? 'https://sandbox.momodeveloper.mtn.com',
    momoEnvironment: process.env.MOMO_ENVIRONMENT ?? 'sandbox',
  },
});
