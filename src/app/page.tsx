'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api, useTurnero } from '@/lib/client';
import type { Ticket } from '@/lib/types';

/** Segundos que se muestra el ticket antes de volver al inicio. */
const BACK_AFTER = 10;

export default function KioskPage() {
  const { state, offline, refresh } = useTurnero();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [left, setLeft] = useState(BACK_AFTER);

  useEffect(() => {
    if (!ticket) return;
    setLeft(BACK_AFTER);
    const id = setInterval(() => {
      setLeft((n) => {
        if (n <= 1) {
          setTicket(null);
          return BACK_AFTER;
        }
        return n - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [ticket]);

  async function take(sectorId: string) {
    setBusy(sectorId);
    setError('');
    try {
      const res = await api<{ ticket: Ticket }>('/api/tickets', { body: { sectorId } });
      setTicket(res.ticket);
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo sacar el número.');
    } finally {
      setBusy(null);
    }
  }

  if (!state) {
    return (
      <main className="grid min-h-screen place-items-center text-slate-500">
        {offline ? 'No hay conexión con el servidor…' : <Loader2 className="animate-spin" />}
      </main>
    );
  }

  const { config, queue } = state;

  if (ticket) {
    const sector = config.sectors.find((s) => s.id === ticket.sectorId);
    // La posición se calcula con la fila en vivo, así baja mientras la persona mira
    const ahead = queue.filter((t) => t.sectorId === ticket.sectorId && t.createdAt < ticket.createdAt).length;
    const stillWaiting = queue.some((t) => t.code === ticket.code);
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="w-full max-w-md animate-pop rounded-3xl bg-white p-10 text-center shadow-2xl shadow-slate-900/10">
          <p className="font-semibold text-slate-500">{config.businessName}</p>
          <p className="mt-2 text-lg">{sector?.name}</p>
          <p
            className="my-4 text-8xl font-extrabold tracking-tight"
            style={{ color: sector?.color }}
          >
            {ticket.code}
          </p>
          <span className="inline-block rounded-full bg-brand-soft px-4 py-2 font-semibold text-brand">
            {!stillWaiting
              ? '¡Te están llamando!'
              : ahead === 0
                ? '¡Sos el próximo!'
                : ahead === 1
                  ? 'Hay 1 persona antes que vos'
                  : `Hay ${ahead} personas antes que vos`}
          </span>
          <p className="mt-5 text-slate-500">Mirá la pantalla, te vamos a llamar por tu número.</p>
          <button className="btn-dark mt-7 w-full py-4 text-lg" onClick={() => setTicket(null)}>
            Listo
          </button>
          <p className="mt-3 text-sm text-slate-400">Vuelve al inicio solo en {left} s</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-10 text-center">
      <h1 className="text-4xl font-extrabold tracking-tight">Bienvenido a {config.businessName}</h1>
      <p className="mb-8 mt-2 text-lg text-slate-500">Tocá el motivo de tu visita para sacar tu número</p>

      <div className="grid gap-4 sm:grid-cols-2">
        {config.sectors.map((s) => {
          const waiting = queue.filter((t) => t.sectorId === s.id).length;
          return (
            <button
              key={s.id}
              onClick={() => take(s.id)}
              disabled={!!busy}
              className="card flex items-center gap-4 border-2 p-6 text-left transition hover:-translate-y-0.5 hover:border-brand hover:shadow-lg disabled:opacity-60"
            >
              <span
                className="grid h-16 w-16 flex-none place-items-center rounded-2xl text-2xl font-extrabold text-white"
                style={{ background: s.color }}
              >
                {busy === s.id ? <Loader2 className="animate-spin" /> : s.prefix}
              </span>
              <span>
                <span className="block text-xl font-bold">{s.name}</span>
                <span className="text-slate-500">{waiting === 0 ? 'Sin espera' : `${waiting} esperando`}</span>
              </span>
            </button>
          );
        })}
      </div>

      {error && <p className="mt-6 font-medium text-red-700">{error}</p>}
      {offline && <p className="mt-6 text-amber-700">Reconectando con el servidor…</p>}
    </main>
  );
}
