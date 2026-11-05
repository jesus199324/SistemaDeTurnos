import { handle, isAuthorized, readJson, unauthorized } from '@/lib/api';
import { updateConfig } from '@/lib/store';
import type { Config } from '@/lib/types';

export async function PUT(req: Request) {
  if (!isAuthorized(req)) return unauthorized();
  const body = await readJson(req);
  return handle(() =>
    updateConfig({
      businessName: String(body.businessName ?? ''),
      desks: Number(body.desks),
      voice: Boolean(body.voice),
      sectors: Array.isArray(body.sectors) ? (body.sectors as Config['sectors']) : [],
    })
  );
}
