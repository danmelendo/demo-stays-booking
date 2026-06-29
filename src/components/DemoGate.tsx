import { useState, type ReactNode } from "react";

// Presentation gate for the Activum demo. Until the access password ("activum")
// is entered, the whole demo (web, app and PMS) is hidden behind this branded
// screen. The unlock is kept per browser session so it isn't asked on every
// route change/reload, but reappears in a fresh session — handy when presenting.
const UNLOCK_KEY = "activum-demo-unlocked";
const PASSWORD = "activum";

function isUnlocked(): boolean {
  if (typeof window === "undefined") return true; // never block during SSR/build
  return window.sessionStorage.getItem(UNLOCK_KEY) === "1";
}

export function DemoGate({ children }: { children: ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean>(isUnlocked);
  const [value, setValue] = useState("");
  const [error, setError] = useState(false);

  if (unlocked) return <>{children}</>;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim().toLowerCase() === PASSWORD) {
      window.sessionStorage.setItem(UNLOCK_KEY, "1");
      setUnlocked(true);
    } else {
      setError(true);
    }
  };

  return (
    <div className="flex min-h-[100svh] w-full items-center justify-center bg-[#efe8d6] px-5">
      <div className="w-full max-w-sm border border-neutral-300 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--brand)]">Stays</p>
        <h1 className="mt-3 text-xl font-semibold leading-snug text-neutral-900">
          Demo adaptada para Activum, propuesta 24/06/2026
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          Introduce la contraseña de acceso para ver la demostración.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-3">
          <input
            type="password"
            autoFocus
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(false);
            }}
            placeholder="Contraseña"
            className="w-full border border-neutral-300 bg-white px-3 py-2.5 text-sm outline-none focus:border-[var(--brand)]"
          />
          {error && <p className="text-xs font-medium text-rose-600">Contraseña incorrecta.</p>}
          <button
            type="submit"
            className="w-full bg-[var(--brand)] py-2.5 text-sm font-semibold text-white"
          >
            Entrar
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-neutral-400">
          Demo · datos simulados en el navegador, sin backend.
        </p>
      </div>
    </div>
  );
}
