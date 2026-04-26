import { useState } from "react";

const menuItemStyle = {
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
};

export default function HamburgerMenu({ onChooseMap, map, user, onUpdateMap }) {
  const [open, setOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const isOwner = map?.created_by === user;
  const members = map?.members ?? [];

  async function handleAddMember(e) {
    e.preventDefault();
    const name = input.trim();
    if (!name) return;
    if (name === user) { setError("That's you"); return; }
    if (members.includes(name)) { setError("Already shared"); return; }
    setBusy(true);
    setError("");
    const res = await fetch(`/api/maps/${map.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: name }),
    });
    if (res.ok) {
      const updated = await res.json();
      onUpdateMap?.(updated);
      setInput("");
    }
    setBusy(false);
  }

  async function handleRemoveMember(username) {
    await fetch(`/api/maps/${map.id}/members/${encodeURIComponent(username)}`, { method: "DELETE" });
    onUpdateMap?.({ ...map, members: members.filter((m) => m !== username) });
  }

  function handleClose() {
    setOpen(false);
    setShareOpen(false);
    setInput("");
    setError("");
  }

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
          <div onClick={handleClose} style={{ position: "fixed", inset: 0, zIndex: -1 }} />
          <div
            style={{
              position: "absolute",
              top: 42,
              right: 0,
              minWidth: 220,
              background: "rgba(10,10,28,0.92)",
              backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {/* Choose Map */}
            <button
              onClick={() => { handleClose(); onChooseMap(); }}
              style={menuItemStyle}
              onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
              onMouseLeave={(e) => e.currentTarget.style.background = "none"}
            >
              Choose Map
            </button>

            {/* Share Map — owner only */}
            {isOwner && (
              <>
                <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 12px" }} />
                <button
                  onClick={() => setShareOpen((s) => !s)}
                  style={{
                    ...menuItemStyle,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    color: shareOpen ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.75)",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                >
                  <span>Share Map</span>
                  {members.length > 0 && (
                    <span style={{
                      fontSize: 10,
                      background: "rgba(255,255,255,0.1)",
                      borderRadius: 99,
                      padding: "1px 6px",
                      fontFamily: "'JetBrains Mono', monospace",
                      color: "rgba(255,255,255,0.5)",
                    }}>
                      {members.length}
                    </span>
                  )}
                </button>

                {shareOpen && (
                  <div style={{ padding: "8px 12px 12px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    {/* Current members */}
                    {members.length > 0 ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 8 }}>
                        {members.map((m) => (
                          <span
                            key={m}
                            style={{
                              display: "inline-flex", alignItems: "center", gap: 4,
                              padding: "2px 8px",
                              borderRadius: 99,
                              background: "rgba(255,255,255,0.08)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              fontSize: 12,
                              color: "rgba(255,255,255,0.7)",
                              fontFamily: "'JetBrains Mono', monospace",
                            }}
                          >
                            {m}
                            <button
                              onClick={() => handleRemoveMember(m)}
                              style={{
                                background: "none", border: "none",
                                color: "rgba(255,255,255,0.35)",
                                cursor: "pointer", padding: 0,
                                fontSize: 13, lineHeight: 1,
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.color = "rgba(239,68,68,0.7)"}
                              onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.35)"}
                            >×</button>
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.3)",
                        marginBottom: 8,
                        fontFamily: "'JetBrains Mono', monospace",
                      }}>
                        Not shared yet
                      </div>
                    )}

                    {/* Add input */}
                    <form onSubmit={handleAddMember} style={{ display: "flex", gap: 5 }}>
                      <input
                        value={input}
                        onChange={(e) => { setInput(e.target.value); setError(""); }}
                        placeholder="Username…"
                        style={{
                          flex: 1,
                          padding: "5px 8px",
                          borderRadius: 5,
                          border: "1px solid rgba(255,255,255,0.15)",
                          background: "rgba(255,255,255,0.06)",
                          color: "#fff",
                          fontSize: 12,
                          outline: "none",
                          fontFamily: "inherit",
                          minWidth: 0,
                        }}
                      />
                      <button
                        type="submit"
                        disabled={busy}
                        style={{
                          padding: "5px 10px",
                          borderRadius: 5,
                          border: "none",
                          background: "oklch(0.82 0.13 200)",
                          color: "#000",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: busy ? "default" : "pointer",
                          fontFamily: "'JetBrains Mono', monospace",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {busy ? "…" : "Add"}
                      </button>
                    </form>
                    {error && (
                      <div style={{ fontSize: 11, color: "oklch(0.75 0.18 30)", marginTop: 4 }}>
                        {error}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
