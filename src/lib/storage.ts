import fs from 'node:fs';
import path from 'node:path';

/**
 * Dónde se guarda el estado del turnero. Hay dos opciones y se elige sola:
 *
 * 1. Redis (Upstash): se usa si están las variables KV_REST_API_URL y KV_REST_API_TOKEN
 *    (las crea Vercel al conectar Upstash Redis desde la pestaña Storage) o
 *    UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN. Es lo necesario en Vercel.
 * 2. Archivo JSON en data/turnero.json: para correrlo en una computadora del local.
 */

export class StorageNotConfigured extends Error {}

export interface Storage {
  read(): Promise<string | null>;
  write(value: string): Promise<void>;
  /** Ejecuta fn sin que otra petición modifique el estado al mismo tiempo. */
  withLock<T>(fn: () => Promise<T>): Promise<T>;
}

const KEY = 'turnero:state';
const LOCK_KEY = 'turnero:lock';

function redisStorage(url: string, token: string): Storage {
  async function cmd<T = unknown>(...args: (string | number)[]): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
      cache: 'no-store',
    });
    const data = (await res.json().catch(() => ({}))) as { result?: T; error?: string };
    if (!res.ok || data.error) throw new Error(`Redis: ${data.error || res.status}`);
    return data.result as T;
  }

  return {
    read: () => cmd<string | null>('GET', KEY),
    write: async (value) => {
      await cmd('SET', KEY, value);
    },
    async withLock(fn) {
      const id = Math.random().toString(36).slice(2);
      const deadline = Date.now() + 5000;
      // Candado simple: solo una petición a la vez puede modificar la fila
      while (!(await cmd<string | null>('SET', LOCK_KEY, id, 'NX', 'PX', 5000))) {
        if (Date.now() > deadline) throw new Error('El sistema está ocupado, probá de nuevo.');
        await new Promise((r) => setTimeout(r, 60));
      }
      try {
        return await fn();
      } finally {
        // Se libera solo si el candado sigue siendo nuestro
        await cmd(
          'EVAL',
          "if redis.call('GET', KEYS[1]) == ARGV[1] then return redis.call('DEL', KEYS[1]) else return 0 end",
          1,
          LOCK_KEY,
          id
        ).catch(() => {});
      }
    },
  };
}

function fileStorage(dir: string): Storage {
  const file = path.join(dir, 'turnero.json');
  let queue: Promise<unknown> = Promise.resolve();
  return {
    async read() {
      try {
        return fs.readFileSync(file, 'utf8');
      } catch {
        return null;
      }
    },
    async write(value) {
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(file + '.tmp', value);
      fs.renameSync(file + '.tmp', file);
    },
    withLock(fn) {
      const run = queue.then(fn, fn);
      queue = run.catch(() => {});
      return run;
    },
  };
}

let storage: Storage | null = null;

export function getStorage(): Storage {
  if (storage) return storage;
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    storage = redisStorage(url, token);
  } else if (process.env.VERCEL) {
    throw new StorageNotConfigured(
      'Falta conectar la base de datos: en Vercel, abrí el proyecto → Storage → Upstash Redis → Connect, y volvé a hacer deploy.'
    );
  } else {
    storage = fileStorage(process.env.TURNERO_DATA_DIR || path.join(process.cwd(), 'data'));
  }
  return storage;
}
