/** Comma-separated FRONTEND_ORIGIN -> array, shared by ConfigService (REST CORS in main.ts)
 * and TicketsGateway (WS CORS), which reads process.env directly since its `cors` option is
 * set at class-decoration time, before Nest's DI container exists to inject ConfigService. */
export function parseFrontendOrigins(): string[] {
  return (process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
