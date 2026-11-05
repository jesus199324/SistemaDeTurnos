import { handle } from '@/lib/api';
import { getState } from '@/lib/store';

export const dynamic = 'force-dynamic';

export function GET() {
  return handle(() => getState());
}
