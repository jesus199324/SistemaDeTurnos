'use client';

import { useEffect, useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { PinGate } from '@/components/PinGate';
import { StaffNav } from '@/components/StaffNav';
import { api, useTurnero } from '@/lib/client';
import type { Config } from '@/lib/types';

const COLORS = ['#1d4ed8', '#15803d', '#b45309', '#7c3aed', '#be123c', '#0e7490', '#4d7c0f', '#c2410c'];

export default function ConfigurarPage() {
  return <PinGate>{(pin, logout) => <Configurar pin={pin} logout={logout} />}</PinGate>;
}

function Configurar({ pin, logout }: { pin: string; logout: () => void }) {
  const { state, offline, refresh } = useTurnero();
  const [draft, setDraft] = useState<Config | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  // Se copia la configuración una sola vez, para que el refresco automático no pise lo que se está editando
  useEffect(() => {
    if (state && !draft) setDraft(structuredClone(state.config));
  }, [state, draft]);

  if (!state || !draft) {
    return (
      <div className="grid min-h-screen place-items-center text-slate-500">
        {offline ? <p className="max-w-md px-6 text-center">{offline}</p> : <Loader2 className="animate-spin" />}
      </div>
    );
  }

  const set = (patch: Partial<Config>) => setDraft({ ...draft, ...patch });
  const setSector = (i: number, patch: Partial<Config['sectors'][number]>) =>
    set({ sectors: draft.sectors.map((s, j) => (j === i ? { ...s, ...patch } : s)) });

  function addSector() {
    const used = new Set(draft!.sectors.map((s) => s.prefix));
    const letter = 'ABCDEFGHJKLMNPQRSTUVWXYZ'.split('').find((l) => !used.has(l)) || 'X';
    set({
      sectors: [
        ...draft!.sectors,
        { id: '', name: 'Nuevo sector', prefix: letter, color: COLORS[draft!.sectors.length % COLORS.length] },
      ],
    });
  }

  async function save() {
    setSaving(true);
    setMsg(null);
    try {
      await api('/api/config', { method: 'PUT', pin, body: draft });
      const res = await fetch('/api/state', { cache: 'no-store' });
      const fresh = await res.json();
      setDraft(structuredClone(fresh.config));
      refresh();
      setMsg({ ok: true, text: 'Cambios guardados.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo guardar.' });
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setConfirmReset(false);
    try {
      await api('/api/reset', { pin });
      refresh();
      setMsg({ ok: true, text: 'Numeración reiniciada. El próximo número de cada sector es el 001.' });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'No se pudo reiniciar.' });
    }
  }

  return (
    <div className="min-h-screen">
      <StaffNav businessName={state.config.businessName} onLogout={logout} />

      <main className="mx-auto max-w-2xl p-5">
        <h1 className="text-2xl font-bold">Configuración del local</h1>
        <p className="mb-5 mt-1 text-slate-500">Nombre, sectores y puestos de atención.</p>

        <section className="card space-y-6 p-6">
          <label className="block">
            <span className="text-sm font-semibold">Nombre del negocio</span>
            <input
              className="field mt-1.5 w-full"
              value={draft.businessName}
              onChange={(e) => set({ businessName: e.target.value })}
            />
          </label>

          <div>
            <span className="text-sm font-semibold">Sectores / motivos de visita</span>
            <p className="mb-2 text-xs text-slate-500">La letra va delante del número (ej: A-001).</p>
            <div className="space-y-2">
              {draft.sectors.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    className="field w-16 text-center font-bold uppercase"
                    maxLength={2}
                    value={s.prefix}
                    onChange={(e) => setSector(i, { prefix: e.target.value.toUpperCase() })}
                    aria-label="Letra"
                  />
                  <input
                    className="field min-w-0 flex-1"
                    value={s.name}
                    onChange={(e) => setSector(i, { name: e.target.value })}
                    aria-label="Nombre del sector"
                  />
                  <input
                    type="color"
                    className="h-11 w-11 cursor-pointer rounded-xl border border-slate-200 bg-white p-1"
                    value={s.color}
                    onChange={(e) => setSector(i, { color: e.target.value })}
                    aria-label="Color"
                  />
                  <button
                    className="btn bg-red-50 px-3 text-red-700 hover:bg-red-100"
                    disabled={draft.sectors.length < 2}
                    onClick={() => set({ sectors: draft.sectors.filter((_, j) => j !== i) })}
                    aria-label="Quitar sector"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button className="btn-light mt-3" onClick={addSector}>
              <Plus className="h-4 w-4" /> Agregar sector
            </button>
          </div>

          <label className="block">
            <span className="text-sm font-semibold">Cantidad de puestos que atienden</span>
            <input
              type="number"
              min={1}
              max={30}
              className="field mt-1.5 block w-28"
              value={draft.desks}
              onChange={(e) => set({ desks: Number(e.target.value) })}
            />
          </label>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="h-5 w-5"
              checked={draft.voice}
              onChange={(e) => set({ voice: e.target.checked })}
            />
            Anunciar el número con voz en la pantalla de sala
          </label>

          <div className="flex items-center gap-3">
            <button className="btn-dark" onClick={save} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} Guardar cambios
            </button>
            {msg && <span className={`text-sm font-medium ${msg.ok ? 'text-green-700' : 'text-red-700'}`}>{msg.text}</span>}
          </div>
        </section>

        <section className="card mt-5 p-6">
          <h2 className="font-semibold">Reiniciar numeración</h2>
          <p className="mb-3 mt-1 text-sm text-slate-500">
            Se hace solo cada día a medianoche. Usalo si querés empezar de cero ahora: se vacía la fila de espera.
          </p>
          {confirmReset ? (
            <div className="flex gap-2">
              <button className="btn bg-red-600 text-white hover:bg-red-700" onClick={reset}>
                Sí, reiniciar
              </button>
              <button className="btn-light" onClick={() => setConfirmReset(false)}>
                Cancelar
              </button>
            </div>
          ) : (
            <button className="btn-light" onClick={() => setConfirmReset(true)}>
              Reiniciar ahora
            </button>
          )}
        </section>
      </main>
    </div>
  );
}
