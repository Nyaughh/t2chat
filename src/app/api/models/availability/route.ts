import { clientIp, guestModelAvailability } from '@/lib/server-quota-client'

/**
 * Which free (server-key) models a guest can use right now: hidden when this deployment has no key
 * for them, when the guest or global daily limit is used up, or while the provider is rate limiting
 * the server key. Signed-in users read the same from Convex (serverQuota.getServerModelAvailability).
 * Never includes keys or counts.
 */
export async function GET(req: Request) {
  const availability = await guestModelAvailability(clientIp(req.headers))
  return Response.json(availability, { headers: { 'Cache-Control': 'no-store' } })
}
