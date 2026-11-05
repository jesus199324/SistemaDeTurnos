'use client';

import { useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { api, getSavedPin, savePin } from '@/lib/client';

/** Pide el PIN antes de mostrar el mostrador o la configuración. Queda guardado en ese equipo. */
export function PinGate({ children }: { children: (pin: string, logout: () => void) => React.ReactNode }) {
  const [pin, setPin] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const saved = getSavedPin();
    if (!saved) {
      setChecking(false);
      return;
    }
    api('/api/login', { pin: saved })
      .then(() => setPin(saved))
      .catch(() => savePin(''))
      .finally(() => setChecking(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api('/api/login', { pin: input });
      savePin(input);
      setPin(input);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'PIN incorrecto.');
    }
  }

  function logout() {
    savePin('');
    setPin(null);
    setInput('');
  }

  if (checking) return null;
  if (pin) return <>{children(pin, logout)}</>;

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <form onSubmit={submit} className="card w-full max-w-sm p-8 text-center">
        <Lock className="mx-auto mb-3 h-8 w-8 text-slate-400" />
        <h1 className="text-xl font-bold">Acceso del personal</h1>
        <p className="mb-5 mt-1 text-sm text-slate-500">Ingresá el PIN para continuar</p>
        <input
          className="field w-full text-center text-2xl tracking-[.4em]"
          type="password"
          inputMode="numeric"
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
        />
        {error && <p className="mt-3 text-sm font-medium text-red-700">{error}</p>}
        <button className="btn-dark mt-5 w-full" disabled={!input}>
          Entrar
        </button>
      </form>
    </main>
  );
}
