import { parseFrontendOrigins } from './frontend-origins';

export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  // Comma-separated for setups with more than one legitimate origin (e.g. a deployed frontend
  // plus a local dev server hitting the same tunneled backend).
  frontendOrigins: parseFrontendOrigins(),
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
    // Only for topologies where frontend and backend sit on genuinely different origins (e.g.
    // this repo's ngrok/Cloudflare-tunnel dev setup) — the real prod topology in DEPLOY.md puts
    // both behind one Caddy origin, where SameSite=Lax is correct and preferable.
    cookieCrossSite: process.env.SESSION_COOKIE_CROSS_SITE === 'true',
  },
  routing: {
    threadIdleWindowMinutes: parseInt(process.env.THREAD_IDLE_WINDOW_MINUTES ?? '180', 10),
  },
});
