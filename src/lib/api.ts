import { NextResponse } from 'next/server';
import { StoreError } from './store';

/** PIN para usar el mostrador y la configuración. Se cambia con la variable TURNERO_PIN. */
export const PIN = process.env.TURNERO_PIN || '1234';

export function isAuthorized(req: Request) {
  return req.headers.get('x-pin') === PIN;
}

export function unauthorized() {
  return NextResponse.json({ error: 'PIN incorrecto.' }, { status: 401 });
}

export function handle<T>(fn: () => T) {
  try {
    return NextResponse.json(fn() ?? { ok: true });
  } catch (e) {
    if (e instanceof StoreError) {
      return NextResponse.json({ error: e.message }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: 'Error inesperado.' }, { status: 500 });
  }
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? body : {};
  } catch {
    return {};
  }
}
