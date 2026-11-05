import { handle, isAuthorized, unauthorized } from '@/lib/api';
import { resetDay } from '@/lib/store';

export async function POST(req: Request) {
  if (!isAuthorized(req)) return unauthorized();
  return handle(() => resetDay());
}
