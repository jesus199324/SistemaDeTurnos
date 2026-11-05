import { handle, isAuthorized, readJson, unauthorized } from '@/lib/api';
import { callCode, callNext, finish, repeatCall, StoreError } from '@/lib/store';

export async function POST(req: Request) {
  if (!isAuthorized(req)) return unauthorized();
  const body = await readJson(req);
  const desk = Number(body.desk);

  return handle(async () => {
    switch (body.action) {
      case 'next': {
        const sectors = Array.isArray(body.sectors) ? body.sectors.map(String) : undefined;
        return { call: await callNext(desk, sectors) };
      }
      case 'call':
        return { call: await callCode(desk, String(body.code ?? '')) };
      case 'repeat':
        return repeatCall(desk);
      case 'done':
        return finish(desk, true);
      case 'noshow':
        return finish(desk, false);
      default:
        throw new StoreError('Acción no válida.');
    }
  });
}
