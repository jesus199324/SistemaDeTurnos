import fs from 'node:fs';
import path from 'node:path';
import type { Call, Config, PublicState, Ticket } from './types';

/**
 * Almacenamiento de los turnos.
 *
 * Se guarda todo en un archivo JSON (data/turnero.json) para que no se pierda
 * si se reinicia el servidor. Está pensado para correr en una sola computadora
 * del local (el tótem, el mostrador y la TV se conectan a ella por la red).
 * Si más adelante se quiere usar en la nube con varios servidores, solo hay que
 * reemplazar las funciones load()/save() por una base de datos (ej: Firestore).
 */

type State = Omit<PublicState, 'stats'> & {
  counters: Record<string, number>;
  stats: PublicState['stats'];
};

const DATA_DIR = process.env.TURNERO_DATA_DIR || path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'turnero.json');

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

function today(): string {
  // Fecha local del servidor, para que la numeración se reinicie a medianoche del lugar
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function emptyDay(config: Config): State {
  return {
    config,
    day: today(),
    queue: [],
    current: {},
    calls: [],
    announceSeq: 0,
    counters: {},
    stats: { served: 0, noShow: 0, issued: 0 },
  };
}

let cache: State | null = null;

function load(): State {
  if (!cache) {
    try {
      cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')) as State;
    } catch {
      cache = emptyDay(DEFAULT_CONFIG);
    }
  }
  // Reinicio automático de la numeración cada día (se conserva la configuración)
  if (cache.day !== today()) {
    cache = { ...emptyDay(cache.config), announceSeq: cache.announceSeq };
    save();
  }
  return cache;
}

function save() {
  if (!cache) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const tmp = DATA_FILE + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(cache, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

export class StoreError extends Error {}

export function getState(): PublicState {
  const { counters: _counters, ...pub } = load();
  return pub;
}

export function takeTicket(sectorId: string): { ticket: Ticket; ahead: number } {
  const s = load();
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
  save();
  return { ticket, ahead };
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
export function callNext(desk: number, sectorIds?: string[]): Call | null {
  const s = load();
  checkDesk(s, desk);
  const idx = s.queue.findIndex((t) => !sectorIds?.length || sectorIds.includes(t.sectorId));
  if (idx === -1) return null;
  const [ticket] = s.queue.splice(idx, 1);
  const call = announce(s, ticket, desk);
  save();
  return call;
}

/** Llama a un número puntual de la fila (fuera de orden). */
export function callCode(desk: number, code: string): Call {
  const s = load();
  checkDesk(s, desk);
  const idx = s.queue.findIndex((t) => t.code === code);
  if (idx === -1) throw new StoreError('Ese número ya no está en la fila.');
  const [ticket] = s.queue.splice(idx, 1);
  const call = announce(s, ticket, desk);
  save();
  return call;
}

export function repeatCall(desk: number) {
  const s = load();
  checkDesk(s, desk);
  const cur = s.current[desk];
  if (!cur) throw new StoreError('Este puesto no está llamando a nadie.');
  const call = { ...cur, at: Date.now() };
  s.current[desk] = call;
  s.calls = [call, ...s.calls.filter((c) => !(c.code === cur.code && c.desk === desk))].slice(0, 10);
  s.announceSeq++;
  save();
}

export function finish(desk: number, attended: boolean) {
  const s = load();
  checkDesk(s, desk);
  if (!s.current[desk]) return;
  if (attended) s.stats.served++;
  else s.stats.noShow++;
  delete s.current[desk];
  save();
}

export function updateConfig(input: Config) {
  const s = load();
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
  save();
}

/** Borra la fila y vuelve a empezar la numeración desde 1 (mantiene la configuración). */
export function resetDay() {
  const s = load();
  cache = { ...emptyDay(s.config), announceSeq: s.announceSeq };
  save();
}
