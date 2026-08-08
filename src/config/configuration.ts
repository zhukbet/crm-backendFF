export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173',
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL ?? 'redis://localhost:6379',
  },
  telegram: {
    botToken: process.env.BOT_TOKEN,
    webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
    webhookUrl: process.env.TELEGRAM_WEBHOOK_URL ?? '',
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    sessionCookieName: process.env.SESSION_COOKIE_NAME ?? 'support_crm_session',
  },
  routing: {
    threadIdleWindowMinutes: parseInt(process.env.THREAD_IDLE_WINDOW_MINUTES ?? '180', 10),
  },
});
