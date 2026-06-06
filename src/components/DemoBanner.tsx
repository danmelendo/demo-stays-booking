import { useState } from "react";
import { IS_DEMO } from "@/integrations/supabase/client";
import { resetDemoDb } from "@/integrations/demo/seed";

// Thin, dismissible banner shown only when the app runs against the in-browser
// mock backend (no Supabase credentials configured). Makes it obvious that data
// is simulated and lets the visitor reset it to the seeded state.
export function DemoBanner() {
  const [hidden, setHidden] = useState(false);
  if (!IS_DEMO || hidden) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 12,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        gap: 12,
        maxWidth: "calc(100vw - 24px)",
        padding: "8px 14px",
        borderRadius: 9999,
        background: "rgba(26,20,16,0.92)",
        color: "#fff",
        fontSize: 12.5,
        fontFamily: "system-ui, sans-serif",
        boxShadow: "0 6px 24px rgba(0,0,0,0.25)",
        backdropFilter: "blur(4px)",
      }}
    >
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
        <span aria-hidden style={{ fontSize: 14 }}>🧪</span>
        Modo demo · datos simulados en tu navegador, sin backend.
      </span>
      <button
        onClick={() => { resetDemoDb(); window.location.reload(); }}
        style={pillBtn}
        title="Restaurar los datos de ejemplo"
      >
        Reiniciar datos
      </button>
      <button onClick={() => setHidden(true)} style={{ ...pillBtn, padding: "2px 8px" }} aria-label="Ocultar aviso">
        ✕
      </button>
    </div>
  );
}

const pillBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.14)",
  color: "#fff",
  border: "1px solid rgba(255,255,255,0.25)",
  borderRadius: 9999,
  padding: "3px 10px",
  fontSize: 12,
  cursor: "pointer",
  whiteSpace: "nowrap",
};
