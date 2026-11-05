import { NextResponse } from 'next/server';
import { isAuthorized, unauthorized } from '@/lib/api';

export function POST(req: Request) {
  if (!isAuthorized(req)) return unauthorized();
  return NextResponse.json({ ok: true });
}
