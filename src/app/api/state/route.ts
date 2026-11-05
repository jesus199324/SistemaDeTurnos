import { handle } from '@/lib/api';
import { getState } from '@/lib/store';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(getState);
}
