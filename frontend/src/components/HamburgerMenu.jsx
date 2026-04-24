import { useState } from "react";

export default function HamburgerMenu({ onChooseMap }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "fixed", top: 16, right: 60, zIndex: 1000 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          width: 36,
          height: 36,
          borderRadius: 5,
          border: "1px solid rgba(255,255,255,0.15)",
          background: "rgba(10,10,28,0.7)",
          color: "rgba(255,255,255,0.7)",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 5,
          backdropFilter: "blur(12px)",
          padding: 0,
        }}
      >
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            style={{
              display: "block",
              width: 16,
              height: 2,
              borderRadius: 1,
              background: "rgba(255,255,255,0.7)",
            }}
          />
        ))}
      </button>

      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: -1 }}
          />
          <div
            style={{
              position: "absolute",
              top: 42,
              right: 0,
              minWidth: 160,
              background: "rgba(10,10,28,0.92)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <button
              onClick={() => { setOpen(false); onChooseMap(); }}
              style={{
                display: "block",
                width: "100%",
                padding: "12px 16px",
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.75)",
                fontSize: 13,
                fontFamily: "'Inter Tight', Inter, sans-serif",
                textAlign: "left",
                cursor: "pointer",
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
            >
              Choose Map
            </button>
          </div>
        </>
      )}
    </div>
  );
}
