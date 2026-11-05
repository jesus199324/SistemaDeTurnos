import { getStorage } from './storage';
import type { Call, Config, PublicState, Ticket } from './types';

/**
 * Lógica de los turnos. El guardado (archivo o base de datos) está en storage.ts.
 * Toda modificación pasa por mutate(), que bloquea para que dos pedidos
 * simultáneos no generen el mismo número.
 */

type State = PublicState & { counters: Record<string, number> };

export const DEFAULT_CONFIG: Config = {
  businessName: 'Mi Negocio',
  desks: 3,
  voice: true,
  sectors: [
    { id: 'atencion', name: 'Atención al cliente', prefix: 'A', color: '#1d4ed8' },
    { id: 'caja', name: 'Caja', prefix: 'C', color: '#15803d' },
    { id: 'retiro', name: 'Retiro de pedidos', prefix: 'R', color: '#b45309' },
  ],
};

/** Zona horaria para el reinicio diario. Se cambia con TURNERO_TZ (ej: America/Argentina/Buenos_Aires). */
const TZ = process.env.TURNERO_TZ || 'America/Montevideo';

function today(): string {
  try {
    // en-CA da el formato YYYY-MM-DD
    return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}

function emptyDay(config: Config, announceSeq = 0): State {
  return {
    config,
    day: today(),
    queue: [],
    current: {},
    calls: [],
    announceSeq,
    counters: {},
    stats: { served: 0, noShow: 0, issued: 0 },
  };
}

async function load(): Promise<State> {
  const raw = await getStorage().read();
  const s: State = raw ? JSON.parse(raw) : emptyDay(DEFAULT_CONFIG);
  // Reinicio automático de la numeración cada día (se conserva la configuración)
  return s.day === today() ? s : emptyDay(s.config, s.announceSeq);
}

async function mutate<T>(fn: (s: State) => T): Promise<T> {
  const storage = getStorage();
  return storage.withLock(async () => {
    const s = await load();
    const result = fn(s);
    await storage.write(JSON.stringify(s));
    return result;
  });
}

export class StoreError extends Error {}

export async function getState(): Promise<PublicState> {
  const { counters: _counters, ...pub } = await load();
  return pub;
}

export function takeTicket(sectorId: string) {
  return mutate((s) => {
    const sector = s.config.sectors.find((x) => x.id === sectorId);
    if (!sector) throw new StoreError('Sector no válido.');
    const n = (s.counters[sector.id] || 0) + 1;
    s.counters[sector.id] = n;
    const ticket: Ticket = {
      code: `${sector.prefix}-${String(n).padStart(3, '0')}`,
      sectorId: sector.id,
      createdAt: Date.now(),
    };
    const ahead = s.queue.filter((t) => t.sectorId === sector.id).length;
    s.queue.push(ticket);
    s.stats.issued++;
    return { ticket, ahead };
  });
}

function checkDesk(s: State, desk: number) {
  if (!Number.isInteger(desk) || desk < 1 || desk > s.config.desks) {
    throw new StoreError('Puesto no válido.');
  }
}

function announce(s: State, ticket: Ticket, desk: number): Call {
  const call: Call = { code: ticket.code, sectorId: ticket.sectorId, desk, at: Date.now() };
  s.current[desk] = call;
  s.calls = [call, ...s.calls].slice(0, 10);
  s.announceSeq++;
  return call;
}

/** Llama al siguiente de la fila. Si se pasan sectores, solo busca en esos. */
export function callNext(desk: number, sectorIds?: string[]) {
  return mutate((s) => {
    checkDesk(s, desk);
    const idx = s.queue.findIndex((t) => !sectorIds?.length || sectorIds.includes(t.sectorId));
    if (idx === -1) return null;
    const [ticket] = s.queue.splice(idx, 1);
    return announce(s, ticket, desk);
  });
}

/** Llama a un número puntual de la fila (fuera de orden). */
export function callCode(desk: number, code: string) {
  return mutate((s) => {
    checkDesk(s, desk);
    const idx = s.queue.findIndex((t) => t.code === code);
    if (idx === -1) throw new StoreError('Ese número ya no está en la fila.');
    const [ticket] = s.queue.splice(idx, 1);
    return announce(s, ticket, desk);
  });
}

export function repeatCall(desk: number) {
  return mutate((s) => {
    checkDesk(s, desk);
    const cur = s.current[desk];
    if (!cur) throw new StoreError('Este puesto no está llamando a nadie.');
    const call = { ...cur, at: Date.now() };
    s.current[desk] = call;
    s.calls = [call, ...s.calls.filter((c) => !(c.code === cur.code && c.desk === desk))].slice(0, 10);
    s.announceSeq++;
  });
}

export function finish(desk: number, attended: boolean) {
  return mutate((s) => {
    checkDesk(s, desk);
    if (!s.current[desk]) return;
    if (attended) s.stats.served++;
    else s.stats.noShow++;
    delete s.current[desk];
  });
}

export function updateConfig(input: Config) {
  return mutate((s) => {
    const prefixes = new Set<string>();
    const ids = new Set<string>();
    const sectors = input.sectors.map((x) => {
      const name = String(x.name || '').trim().slice(0, 40);
      const prefix = String(x.prefix || '').trim().toUpperCase().slice(0, 2);
      if (!name || !prefix) throw new StoreError('Cada sector necesita nombre y letra.');
      if (prefixes.has(prefix)) throw new StoreError(`La letra "${prefix}" está repetida.`);
      prefixes.add(prefix);
      const id = String(x.id || '').trim() || `s${Date.now().toString(36)}${ids.size}`;
      ids.add(id);
      const color = /^#[0-9a-f]{6}$/i.test(x.color) ? x.color : '#1d4ed8';
      return { id, name, prefix, color };
    });
    if (!sectors.length) throw new StoreError('Tiene que haber al menos un sector.');
    const desks = Math.min(Math.max(Math.round(Number(input.desks) || 1), 1), 30);

    s.config = {
      businessName: String(input.businessName || '').trim().slice(0, 60) || 'Mi Negocio',
      sectors,
      desks,
      voice: !!input.voice,
    };
    // Si se borró un sector, se sacan de la fila sus turnos pendientes
    s.queue = s.queue.filter((t) => ids.has(t.sectorId));
  });
}

/** Borra la fila y vuelve a empezar la numeración desde 1 (mantiene la configuración). */
export function resetDay() {
  return mutate((s) => {
    Object.assign(s, emptyDay(s.config, s.announceSeq));
  });
}
