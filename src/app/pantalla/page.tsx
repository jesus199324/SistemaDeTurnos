'use client';

import { useEffect, useRef, useState } from 'react';
import { Volume2 } from 'lucide-react';
import { chime, speakCall, unlockAudio, useTurnero } from '@/lib/client';

export default function PantallaPage() {
  const { state, offline } = useTurnero();
  const [soundOn, setSoundOn] = useState(false);
  const [flashKey, setFlashKey] = useState(0);
  const [now, setNow] = useState<Date | null>(null);
  const lastSeq = useRef<number | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(id);
  }, []);

  // Cuando el mostrador llama (o repite), parpadea el número y suena el aviso
  useEffect(() => {
    if (!state) return;
    const seq = state.announceSeq;
    if (lastSeq.current !== null && seq > lastSeq.current && state.calls[0]) {
      setFlashKey((k) => k + 1);
      if (soundOn) {
        chime();
        if (state.config.voice) {
          const { code, desk } = state.calls[0];
          setTimeout(() => speakCall(code, desk), 700);
        }
      }
    }
    lastSeq.current = seq;
  }, [state, soundOn]);

  function enableSound() {
    unlockAudio();
    setSoundOn(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  const last = state?.calls[0];
  const recent = state?.calls.slice(1, 6) ?? [];

  return (
    <div className="grid min-h-screen bg-[#0b1220] text-white md:grid-cols-[2fr_1fr]">
      <main className="flex flex-col items-center justify-center p-8 text-center">
        {last ? (
          <>
            <p className="text-2xl font-semibold uppercase tracking-[.15em] text-slate-400">Turno</p>
            <p key={flashKey} className="my-3 animate-flash text-[length:clamp(110px,16vw,240px)] font-extrabold leading-none tracking-tighter">
              {last.code}
            </p>
            <p className="rounded-2xl bg-brand px-8 py-3 text-[length:clamp(28px,3.6vw,56px)] font-bold">Puesto {last.desk}</p>
          </>
        ) : (
          <p className="text-3xl text-slate-500">
            {state?.config.businessName ?? ''}
            <br />
            <span className="text-xl">Esperando el primer llamado…</span>
          </p>
        )}
      </main>

      <aside className="border-t border-slate-800 bg-[#111a2e] p-7 md:border-l md:border-t-0">
        <h2 className="mb-3 text-base font-semibold uppercase tracking-[.12em] text-slate-400">Últimos llamados</h2>
        {recent.length === 0 && <p className="text-slate-600">—</p>}
        {recent.map((c) => (
          <div
            key={`${c.code}-${c.at}`}
            className="flex items-center justify-between border-b border-slate-800 py-4 text-[length:clamp(22px,2.2vw,34px)] font-bold"
          >
            {c.code}
            <span className="text-[.7em] font-medium text-slate-400">Puesto {c.desk}</span>
          </div>
        ))}
        {now && (
          <p className="mt-6 capitalize text-slate-500">
            {now.toLocaleString('es', { weekday: 'long', hour: '2-digit', minute: '2-digit' })}
          </p>
        )}
        {offline && <p className="mt-3 text-amber-400">Reconectando…</p>}
      </aside>

      {!soundOn && (
        <button
          onClick={enableSound}
          className="fixed inset-0 z-10 grid place-items-center bg-black/70 text-white backdrop-blur-sm"
        >
          <span className="flex flex-col items-center gap-3">
            <Volume2 className="h-14 w-14" />
            <span className="text-2xl font-bold">Tocá para activar el sonido</span>
            <span className="text-slate-300">y poner la pantalla completa</span>
          </span>
        </button>
      )}
    </div>
  );
}
