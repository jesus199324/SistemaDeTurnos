import { handle, isAuthorized, unauthorized } from '@/lib/api';
import { resetDay } from '@/lib/store';

export function POST(req: Request) {
  if (!isAuthorized(req)) return unauthorized();
  return handle(() => resetDay());
}
