/**
 * Railway health check. Lives under /api so the i18n middleware skips it —
 * a locale redirect would make the platform read the service as unhealthy.
 */
export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ status: 'ok' });
}
