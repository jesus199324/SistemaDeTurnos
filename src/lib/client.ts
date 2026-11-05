'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { PublicState } from './types';

/** Cada cuánto se actualizan las pantallas (ms). */
const POLL_MS = 1500;

/** Estado compartido del turnero, se refresca solo cada pocos segundos. */
export function useTurnero() {
  const [state, setState] = useState<PublicState | null>(null);
  /** Mensaje si no se pudo leer el estado ('' si todo anda bien) */
  const [offline, setOffline] = useState('');
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'No hay conexión con el servidor…');
      if (alive.current) {
        setState(data as PublicState);
        setOffline('');
      }
    } catch (e) {
      const msg = e instanceof Error && e.message !== 'Failed to fetch' ? e.message : 'No hay conexión con el servidor…';
      if (alive.current) setOffline(msg);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    refresh();
    const id = setInterval(refresh, POLL_MS);
    return () => {
      alive.current = false;
      clearInterval(id);
    };
  }, [refresh]);

  return { state, offline, refresh };
}

const PIN_KEY = 'turnero-pin';

export function getSavedPin(): string {
  try {
    return localStorage.getItem(PIN_KEY) || '';
  } catch {
    return '';
  }
}

export function savePin(pin: string) {
  try {
    if (pin) localStorage.setItem(PIN_KEY, pin);
    else localStorage.removeItem(PIN_KEY);
  } catch {}
}

export async function api<T = unknown>(
  url: string,
  options: { method?: string; body?: unknown; pin?: string } = {}
): Promise<T> {
  const res = await fetch(url, {
    method: options.method || 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(options.pin ? { 'x-pin': options.pin } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'No se pudo completar la acción.');
  return data as T;
}

export function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
}

/** Timbre de dos tonos + anuncio por voz del número llamado. */
let audioCtx: AudioContext | null = null;

export function unlockAudio() {
  try {
    audioCtx = audioCtx || new AudioContext();
    if (audioCtx.state === 'suspended') audioCtx.resume();
  } catch {}
}

export function chime() {
  try {
    unlockAudio();
    const ctx = audioCtx!;
    [880, 660].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t0 = ctx.currentTime + i * 0.3;
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.exponentialRampToValueAtTime(0.3, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
      osc.start(t0);
      osc.stop(t0 + 0.3);
    });
  } catch {}
}

export function speakCall(code: string, desk: number) {
  try {
    const [prefix, num] = code.split('-');
    const text = `Turno ${prefix.split('').join(' ')} ${parseInt(num, 10)}. Puesto ${desk}.`;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    u.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
  } catch {}
}
