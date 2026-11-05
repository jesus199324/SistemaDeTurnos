'use client';

import { useEffect, useState } from 'react';
import { Check, Loader2, Megaphone, RotateCcw, X } from 'lucide-react';
import { PinGate } from '@/components/PinGate';
import { StaffNav } from '@/components/StaffNav';
import { api, formatTime, useTurnero } from '@/lib/client';

export default function MostradorPage() {
  return <PinGate>{(pin, logout) => <Mostrador pin={pin} logout={logout} />}</PinGate>;
}

function useSaved(key: string, initial: string) {
  const [value, setValue] = useState(initial);
  useEffect(() => {
    try {
      const v = localStorage.getItem(key);
      if (v) setValue(v);
    } catch {}
  }, [key]);
  const set = (v: string) => {
    setValue(v);
    try {
      localStorage.setItem(key, v);
    } catch {}
  };
  return [value, set] as const;
}

function Mostrador({ pin, logout }: { pin: string; logout: () => void }) {
  const { state, offline, refresh } = useTurnero();
  // Cada equipo recuerda en qué puesto está y qué sector atiende
  const [desk, setDesk] = useSaved('turnero-desk', '1');
  const [filter, setFilter] = useSaved('turnero-filter', 'all');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  if (!state) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-500">
        {offline ? <p className="max-w-md px-6 text-center">{offline}</p> : <Loader2 className="animate-spin" />}
      </div>
    );
  }

  const { config, queue, current, stats } = state;
  const deskNum = Math.min(Number(desk) || 1, config.desks);
  const activeFilter = config.sectors.some((s) => s.id === filter) ? filter : 'all';
  const list = queue.filter((t) => activeFilter === 'all' || t.sectorId === activeFilter);
  const cur = current[deskNum];
  const sectorOf = (id: string) => config.sectors.find((s) => s.id === id);
  const curSector = cur && sectorOf(cur.sectorId);

  async function act(body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    try {
      await api('/api/desk', { pin, body: { desk: deskNum, ...body } });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <StaffNav businessName={config.businessName} onLogout={logout} />

      <main className="mx-auto max-w-5xl p-5">
        <div className="mb-5 flex flex-wrap items-center gap-3">
          <h1 className="mr-auto text-2xl font-bold">Mostrador</h1>
          <label className="flex items-center gap-2 text-sm text-slate-500">
            Puesto
            <select className="field" value={deskNum} onChange={(e) => setDesk(e.target.value)}>
              {Array.from({ length: config.desks }, (_, i) => i + 1).map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <select className="field" value={activeFilter} onChange={(e) => setFilter(e.target.value)}>
            <option value="all">Todos los sectores</option>
            {config.sectors.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-3">
          <Stat value={queue.length} label="Esperando" />
          <Stat value={stats.served} label="Atendidos hoy" />
          <Stat value={stats.noShow} label="No se presentaron" />
        </div>

        <div className="grid gap-4 md:grid-cols-[1.1fr_1fr]">
          <section className="card p-5 text-center">
            <p className="text-sm font-medium text-slate-500">Atendiendo en puesto {deskNum}</p>
            {cur ? (
              <>
                <p className="my-1 text-7xl font-extrabold tracking-tight" style={{ color: curSector?.color }}>
                  {cur.code}
                </p>
                <p className="text-slate-500">{curSector?.name}</p>
              </>
            ) : (
              <p className="py-8 text-xl text-slate-400">Nadie en este momento</p>
            )}

            <button
              className="btn mt-4 w-full bg-brand py-5 text-xl text-white hover:bg-blue-800"
              disabled={busy || list.length === 0}
              onClick={() => act({ action: 'next', sectors: activeFilter === 'all' ? [] : [activeFilter] })}
            >
              <Megaphone className="h-6 w-6" />
              {list.length ? `Llamar siguiente → ${list[0].code}` : 'No hay nadie esperando'}
            </button>

            <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
              <button className="btn-light" disabled={busy || !cur} onClick={() => act({ action: 'repeat' })}>
                <RotateCcw className="h-4 w-4" /> Repetir
              </button>
              <button
                className="btn bg-green-100 text-green-800 hover:bg-green-200"
                disabled={busy || !cur}
                onClick={() => act({ action: 'done' })}
              >
                <Check className="h-4 w-4" /> Atendido
              </button>
              <button
                className="btn bg-red-100 text-red-800 hover:bg-red-200"
                disabled={busy || !cur}
                onClick={() => act({ action: 'noshow' })}
              >
                <X className="h-4 w-4" /> No vino
              </button>
            </div>
            {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
            {offline && <p className="mt-3 text-sm text-amber-700">Reconectando…</p>}
          </section>

          <section className="card p-5">
            <h2 className="mb-2 font-semibold">En espera ({list.length})</h2>
            <ul className="max-h-[380px] overflow-auto">
              {list.length === 0 && <li className="py-3 text-slate-400">Vacío</li>}
              {list.map((t) => {
                const s = sectorOf(t.sectorId);
                return (
                  <li key={t.code} className="flex items-center gap-3 border-b border-slate-100 py-2.5 last:border-0">
                    <span className="h-2.5 w-2.5 flex-none rounded-full" style={{ background: s?.color }} />
                    <span className="w-16 font-bold">{t.code}</span>
                    <span className="truncate text-sm">{s?.name}</span>
                    <span className="ml-auto text-xs text-slate-400">{formatTime(t.createdAt)}</span>
                    <button
                      className="btn-light px-2.5 py-1 text-xs"
                      disabled={busy}
                      onClick={() => act({ action: 'call', code: t.code })}
                    >
                      Llamar
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      </main>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="card px-4 py-3">
      <b className="block text-2xl">{value}</b>
      <span className="text-sm text-slate-500">{label}</span>
    </div>
  );
}
