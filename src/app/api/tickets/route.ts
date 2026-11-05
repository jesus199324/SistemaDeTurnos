import { handle, readJson } from '@/lib/api';
import { takeTicket } from '@/lib/store';

export async function POST(req: Request) {
  const body = await readJson(req);
  return handle(() => takeTicket(String(body.sectorId ?? '')));
}
