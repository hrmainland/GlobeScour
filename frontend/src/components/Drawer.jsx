import { useState, useRef, useEffect } from "react";
import NotesEditor from "./NotesEditor";

const TRAFFIC_COLORS = {
  green: {
    dot: "#22c55e",
    glow: "rgba(34,197,94,0.45)",
    tint: "rgba(34,197,94,0.06)",
    border: "rgba(34,197,94,0.18)",
  },
  amber: {
    dot: "#f59e0b",
    glow: "rgba(245,158,11,0.45)",
    tint: "rgba(245,158,11,0.06)",
    border: "rgba(245,158,11,0.18)",
  },
  red: {
    dot: "#ef4444",
    glow: "rgba(239,68,68,0.45)",
    tint: "rgba(239,68,68,0.06)",
    border: "rgba(239,68,68,0.18)",
  },
  none: {
    dot: "rgba(255,255,255,0.15)",
    glow: "none",
    tint: "rgba(255,255,255,0.03)",
    border: "rgba(255,255,255,0.08)",
  },
};

const INITIAL_PX = () => window.innerHeight * 0.45;

function CriterionCard({ criterion, rating, note }) {
  const c = TRAFFIC_COLORS[rating] ?? TRAFFIC_COLORS.none;
  return (
    <div
      style={{
        background: c.tint,
        border: `1px solid ${c.border}`,
        borderRadius: 8,
        padding: "14px 16px",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        flex: "1 1 0",
        minWidth: 140,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            flexShrink: 0,
            background: c.dot,
            boxShadow:
              rating && rating !== "none" ? `0 0 7px ${c.glow}` : "none",
          }}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "rgba(255,255,255,0.75)",
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          {criterion}
        </span>
      </div>
      {note && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "rgba(255,255,255,0.5)",
            lineHeight: 1.5,
          }}
        >
          {note}
        </p>
      )}
    </div>
  );
}

export default function Drawer({
  pin,
  criteria,
  onClose,
  onStatusChange,
  onResearchDone,
  onDelete,
  onRename,
  onSaveSuggestion,
  user,
}) {
  const [research, setResearch] = useState(pin.research ?? null);
  const [sources, setSources] = useState(pin.research?.sources ?? []);
  const [status, setStatus] = useState(pin.research_status ?? "none");
  const [sourceMeta, setSourceMeta] = useState({});
  const [userLinks, setUserLinks] = useState(pin.user_links ?? []);
  const [addingLink, setAddingLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");
  const [linkDesc, setLinkDesc] = useState("");
  const [linkSaving, setLinkSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [heightPx, setHeightPx] = useState(INITIAL_PX);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(pin.name ?? "");

  const drawerRef = useRef(null);
  const contentRef = useRef(null);
  const dragRef = useRef(null);
  const headerRef = useRef(null);
  const heightRef = useRef(INITIAL_PX());
  const minPxRef = useRef(110); // overwritten after mount with real header height

  const criteriaItems = criteria?.items ?? [];
  const allCriteriaKeys = [
    ...criteriaItems,
    ...Object.keys(research?.ratings ?? {}).filter(
      (k) => !criteriaItems.includes(k),
    ),
  ];

  // ── Measure header height once mounted ──
  useEffect(() => {
    if (headerRef.current) minPxRef.current = headerRef.current.offsetHeight;
  }, []);

  // ── Wheel: resize from anywhere on screen ──
  useEffect(() => {
    function onWheel(e) {
      const h = heightRef.current;
      const maxPx = window.innerHeight;
      const minPx = minPxRef.current;

      // If the event is inside the scrollable content and it's not at the top,
      // let it scroll normally without resizing
      const insideContent = contentRef.current?.contains(e.target);
      const contentScrolled =
        contentRef.current && contentRef.current.scrollTop > 1;
      if (insideContent && contentScrolled) return;

      if (e.deltaY > 0 && h < maxPx) {
        e.preventDefault();
        const next = Math.min(maxPx, h + Math.abs(e.deltaY) * 0.8);
        heightRef.current = next;
        setHeightPx(next);
      } else if (e.deltaY < 0 && h > minPx) {
        e.preventDefault();
        const next = Math.max(minPx, h - Math.abs(e.deltaY) * 0.8);
        heightRef.current = next;
        setHeightPx(next);
      }
    }

    window.addEventListener("wheel", onWheel, { passive: false });
    return () => window.removeEventListener("wheel", onWheel);
  }, []);

  // ── Drag handle ──
  useEffect(() => {
    const handle = dragRef.current;
    if (!handle) return;

    let startY = 0;
    let startH = 0;

    function onMouseMove(e) {
      const dy = startY - e.clientY;
      const next = Math.min(
        window.innerHeight,
        Math.max(minPxRef.current, startH + dy),
      );
      heightRef.current = next;
      setHeightPx(next);
    }
    function onMouseUp() {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    }
    function onMouseDown(e) {
      startY = e.clientY;
      startH = heightRef.current;
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    }

    handle.addEventListener("mousedown", onMouseDown);
    return () => {
      handle.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  function handleNameCommit() {
    setEditingName(false);
    const trimmed = nameValue.trim();
    if (!trimmed) {
      setNameValue(pin.name ?? "");
      return;
    }
    if (pin.isSuggestion) {
      onSaveSuggestion?.(pin, trimmed);
    } else if (trimmed !== pin.name) {
      onRename?.(pin.id, trimmed);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    await fetch(`/api/locations/${pin.id}`, { method: "DELETE" });
    onDelete?.(pin.id);
  }

  async function handleAddLink(e) {
    e.preventDefault();
    const url = linkUrl.trim();
    const title = linkTitle.trim();
    if (!url || !title) return;
    setLinkSaving(true);
    const res = await fetch(`/api/locations/${pin.id}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, title, description: linkDesc.trim(), added_by: user }),
    });
    const link = await res.json();
    setUserLinks((prev) => [...prev, link]);
    setLinkUrl("");
    setLinkTitle("");
    setLinkDesc("");
    setAddingLink(false);
    setLinkSaving(false);
  }

  async function handleDeleteLink(linkId) {
    await fetch(`/api/locations/${pin.id}/links/${linkId}`, { method: "DELETE" });
    setUserLinks((prev) => prev.filter((l) => l.id !== linkId));
  }

  async function handleResearch(deep = false) {
    const res = await fetch(`/api/locations/${pin.id}/research`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deep }),
    });
    if (res.ok) {
      setStatus("pending");
      onStatusChange?.(pin.id, "pending");
    }
  }

  useEffect(() => {
    if (status !== "pending") return;
    const intervalId = setInterval(async () => {
      try {
        const res = await fetch(`/api/locations/${pin.id}`);
        if (!res.ok) return;
        const data = await res.json();
        const newStatus = data.research_status;
        if (newStatus === "done") {
          setStatus("done");
          setResearch(data.research);
          setSources(data.research?.sources ?? []);
          onResearchDone(data.research);
        }
        if (newStatus === "failed") setStatus("failed");
      } catch {
        // network error — skip this tick, try again next
      }
    }, 3000);
    return () => clearInterval(intervalId);
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const sources = research?.sources ?? [];
    sources.forEach(async (url) => {
      if (!url.startsWith("http") || sourceMeta[url] !== undefined) return;
      // Mark as in-flight so we don't double-fetch
      setSourceMeta((prev) => ({ ...prev, [url]: null }));
      try {
        const res = await fetch(
          `https://api.microlink.io/?url=${encodeURIComponent(url)}`,
        );
        const data = await res.json();
        if (data.status === "success") {
          setSourceMeta((prev) => ({
            ...prev,
            [url]: {
              title: data.data.title || null,
              publisher: data.data.publisher || null,
            },
          }));
        }
      } catch {
        // leave as null — falls back to raw URL display
      }
    });
  }, [research]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{ position: "fixed", inset: 0, zIndex: 900 }}
      />

      {/* Sheet */}
      <div
        ref={drawerRef}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: `${heightPx}px`,
          zIndex: 901,
          background: "rgba(10,10,28,0.92)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          borderTop: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "16px 16px 0 0",
          display: "flex",
          flexDirection: "column",
          color: "#fff",
          fontFamily: "'Inter Tight', Inter, sans-serif",
          overflow: "hidden",
        }}
      >
        {/* Drag handle + header — measured together for min height */}
        <div ref={headerRef} style={{ flexShrink: 0 }}>
          <div
            ref={dragRef}
            style={{
              padding: "12px 0 8px",
              display: "flex",
              justifyContent: "center",
              cursor: "row-resize",
            }}
          >
            <div
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                background: "rgba(255,255,255,0.18)",
              }}
            />
          </div>

          {/* Header */}
          <div
            style={{
              padding: "0 24px 16px",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: "'JetBrains Mono', monospace",
                  marginBottom: 4,
                }}
              >
                {pin.isSuggestion
                  ? "suggested"
                  : pin.location_type === "coordinate"
                    ? `${pin.lat.toFixed(3)}, ${pin.lng.toFixed(3)}`
                    : pin.location_type}
              </div>
              {editingName ? (
                <input
                  value={nameValue}
                  onChange={(e) => setNameValue(e.target.value)}
                  onBlur={handleNameCommit}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.target.blur();
                    if (e.key === "Escape") {
                      setNameValue(pin.name ?? "");
                      setEditingName(false);
                    }
                  }}
                  autoFocus
                  style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px solid rgba(255,255,255,0.3)",
                    color: "#fff",
                    outline: "none",
                    width: "100%",
                    fontFamily: "inherit",
                    padding: 0,
                  }}
                />
              ) : (
                <h2
                  onClick={() => setEditingName(true)}
                  style={{
                    margin: 0,
                    fontSize: 22,
                    fontWeight: 700,
                    lineHeight: 1.2,
                    cursor: "text",
                  }}
                >
                  {nameValue}
                </h2>
              )}
              {!pin.isSuggestion && (
                <div
                  style={{
                    fontSize: 12,
                    color: "rgba(255,255,255,0.35)",
                    marginTop: 4,
                  }}
                >
                  Added by {pin.created_by}
                </div>
              )}
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexShrink: 0,
              }}
            >
              {!pin.isSuggestion && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    background: "none",
                    border: "none",
                    color: "rgba(239,68,68,0.5)",
                    fontSize: 12,
                    cursor: "pointer",
                    padding: "4px 6px",
                    lineHeight: 1,
                    fontFamily: "'JetBrains Mono', monospace",
                    letterSpacing: "0.04em",
                  }}
                >
                  {deleting ? "deleting…" : "delete"}
                </button>
              )}
              <button
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.4)",
                  fontSize: 20,
                  cursor: "pointer",
                  padding: "2px 4px",
                  lineHeight: 1,
                }}
              >
                ✕
              </button>
            </div>
          </div>
        </div>
        {/* end headerRef wrapper */}

        {/* Scrollable body */}
        <div
          ref={contentRef}
          style={{ flex: 1, overflowY: "auto", padding: "20px 24px 40px" }}
        >
          {pin.isSuggestion ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 12,
                maxWidth: 480,
              }}
            >
              {pin.placeName && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: "rgba(255,255,255,0.4)",
                    lineHeight: 1.5,
                  }}
                >
                  {pin.placeName}
                </p>
              )}
              <p
                style={{
                  margin: 0,
                  fontSize: 14,
                  color: "rgba(255,255,255,0.55)",
                  lineHeight: 1.6,
                }}
              >
                Save this spot to your map, or research it straight away.
              </p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => onSaveSuggestion?.(pin, nameValue)}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 2,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.08)",
                    color: "rgba(255,255,255,0.8)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    letterSpacing: "0.04em",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  Save pin
                </button>
                <button
                  onClick={() => onSaveSuggestion?.(pin, nameValue, { research: true })}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 2,
                    border: "1px solid oklch(0.82 0.13 200)",
                    background: "oklch(0.82 0.13 200 / 0.12)",
                    color: "oklch(0.82 0.13 200)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    letterSpacing: "0.04em",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  Research
                </button>
                <button
                  onClick={() => onSaveSuggestion?.(pin, nameValue, { research: true, deep: true })}
                  style={{
                    padding: "10px 20px",
                    borderRadius: 2,
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(255,255,255,0.06)",
                    color: "rgba(255,255,255,0.6)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    letterSpacing: "0.04em",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  Deep research
                </button>
              </div>
            </div>
          ) : (
            status === "none" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  maxWidth: 480,
                }}
              >
                {criteriaItems.length > 0 && (
                  <p
                    style={{
                      margin: 0,
                      fontSize: 13,
                      color: "rgba(255,255,255,0.35)",
                      lineHeight: 1.5,
                    }}
                  >
                    Will rate: {criteriaItems.join(" · ")}
                  </p>
                )}
                <p
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: "rgba(255,255,255,0.55)",
                    lineHeight: 1.6,
                  }}
                >
                  Claude will search the web and rate this spot across your
                  criteria.
                </p>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => handleResearch(false)}
                    style={{
                      padding: "12px 24px",
                      borderRadius: 2,
                      border: "1px solid oklch(0.82 0.13 200)",
                      background: "oklch(0.82 0.13 200 / 0.12)",
                      color: "oklch(0.82 0.13 200)",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      letterSpacing: "0.04em",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    Research
                  </button>
                  <button
                    onClick={() => handleResearch(true)}
                    style={{
                      padding: "12px 24px",
                      borderRadius: 2,
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "rgba(255,255,255,0.06)",
                      color: "rgba(255,255,255,0.6)",
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: "pointer",
                      letterSpacing: "0.04em",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}
                  >
                    Deep research
                  </button>
                </div>
              </div>
            )
          )}

          {status === "pending" && (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: "2px solid rgba(255,255,255,0.1)",
                  borderTopColor: "oklch(0.82 0.13 200)",
                  animation: "spin 0.8s linear infinite",
                  margin: "0 auto 16px",
                }}
              />
              <p
                style={{
                  fontSize: 13,
                  color: "rgba(255,255,255,0.45)",
                  margin: 0,
                }}
              >
                Searching the web…
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
            </div>
          )}

          {status === "failed" && (
            <div
              style={{
                padding: "12px 14px",
                borderRadius: 2,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                fontSize: 13,
                color: "#ef4444",
                maxWidth: 480,
              }}
            >
              Research failed.
              <button
                onClick={handleResearch}
                style={{
                  display: "block",
                  marginTop: 10,
                  fontSize: 12,
                  background: "none",
                  border: "none",
                  color: "rgba(255,255,255,0.5)",
                  cursor: "pointer",
                  padding: 0,
                  textDecoration: "underline",
                }}
              >
                Try again
              </button>
            </div>
          )}

          {research && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 24,
                alignItems: "center",
              }}
            >
              <div style={{ width: "100%" }}>
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.3)",
                    fontFamily: "'JetBrains Mono', monospace",
                    marginBottom: 10,
                  }}
                >
                  Summary
                </div>
                <p
                  style={{
                    maxWidth: 720,
                    margin: "0 auto",
                    fontSize: 14,
                    color: "rgba(255,255,255,0.75)",
                    lineHeight: 1.65,
                    textAlign: "center",
                  }}
                >
                  {research.summary}
                </p>
              </div>

              {allCriteriaKeys.length > 0 && (
                <div style={{ width: "100%" }}>
                  <div
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.3)",
                      fontFamily: "'JetBrains Mono', monospace",
                      marginBottom: 10,
                    }}
                  >
                    Criteria
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
                    {allCriteriaKeys.map((c) => (
                      <CriterionCard
                        key={c}
                        criterion={c}
                        rating={research.ratings?.[c]}
                        note={research.ratings_notes?.[c]}
                      />
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}

          {!pin.isSuggestion && (
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.07)",
                paddingTop: 20,
                marginTop: 8,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "rgba(255,255,255,0.3)",
                  fontFamily: "'JetBrains Mono', monospace",
                  marginBottom: 10,
                }}
              >
                Notes
              </div>
              <NotesEditor
                pinId={pin.id}
                initialContent={pin.notes ?? ""}
                initialEditedBy={pin.notes_last_edited_by ?? null}
                initialEditedAt={pin.notes_last_edited_at ?? null}
                user={user}
              />
            </div>
          )}

          {!pin.isSuggestion && (
            <div
              style={{
                borderTop: "1px solid rgba(255,255,255,0.07)",
                paddingTop: 20,
                marginTop: 8,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: userLinks.length > 0 || addingLink ? 10 : 0,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.3)",
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  Links
                </div>
                {!addingLink && (
                  <button
                    onClick={() => setAddingLink(true)}
                    style={{
                      background: "none",
                      border: "none",
                      color: "rgba(255,255,255,0.35)",
                      fontSize: 11,
                      cursor: "pointer",
                      fontFamily: "'JetBrains Mono', monospace",
                      padding: 0,
                    }}
                  >
                    + add
                  </button>
                )}
              </div>

              {addingLink && (
                <form
                  onSubmit={handleAddLink}
                  style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}
                >
                  {[
                    { value: linkUrl, setter: setLinkUrl, placeholder: "URL", type: "url", required: true },
                    { value: linkTitle, setter: setLinkTitle, placeholder: "Title", required: true },
                    { value: linkDesc, setter: setLinkDesc, placeholder: "Description (optional)" },
                  ].map(({ value, setter, placeholder, type = "text", required }) => (
                    <input
                      key={placeholder}
                      type={type}
                      value={value}
                      onChange={(e) => setter(e.target.value)}
                      placeholder={placeholder}
                      required={required}
                      style={{
                        padding: "6px 10px",
                        borderRadius: 5,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(255,255,255,0.06)",
                        color: "#fff",
                        fontSize: 12,
                        outline: "none",
                        fontFamily: "inherit",
                      }}
                    />
                  ))}
                  <div style={{ display: "flex", gap: 6 }}>
                    <button
                      type="submit"
                      disabled={linkSaving}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 5,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(255,255,255,0.08)",
                        color: linkSaving ? "rgba(255,255,255,0.3)" : "rgba(255,255,255,0.7)",
                        fontSize: 12,
                        cursor: linkSaving ? "default" : "pointer",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      {linkSaving ? "Saving…" : "Save"}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setAddingLink(false); setLinkUrl(""); setLinkTitle(""); setLinkDesc(""); }}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 5,
                        border: "none",
                        background: "none",
                        color: "rgba(255,255,255,0.3)",
                        fontSize: 12,
                        cursor: "pointer",
                        fontFamily: "'JetBrains Mono', monospace",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {userLinks.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {userLinks.map((link) => {
                    const hostname = (() => { try { return new URL(link.url).hostname.replace(/^www\./, ""); } catch { return null; } })();
                    return (
                      <div key={link.id} style={{ position: "relative" }}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "block",
                            padding: "10px 32px 10px 12px",
                            borderRadius: 6,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "rgba(255,255,255,0.03)",
                            textDecoration: "none",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                        >
                          <div style={{ fontSize: 13, color: "rgba(255,255,255,0.75)", fontWeight: 500, lineHeight: 1.4 }}>
                            {link.title}
                          </div>
                          {link.description && (
                            <div style={{ fontSize: 12, color: "rgba(255,255,255,0.45)", marginTop: 3, lineHeight: 1.4 }}>
                              {link.description}
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 3, flexWrap: "wrap" }}>
                            {hostname && (
                              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "'JetBrains Mono', monospace" }}>
                                {hostname}
                              </span>
                            )}
                            {link.added_by && (
                              <span style={{
                                fontSize: 10,
                                color: "rgba(255,255,255,0.35)",
                                background: "rgba(255,255,255,0.07)",
                                border: "1px solid rgba(255,255,255,0.1)",
                                borderRadius: 99,
                                padding: "1px 7px",
                                fontFamily: "'JetBrains Mono', monospace",
                              }}>
                                {link.added_by}
                              </span>
                            )}
                          </div>
                        </a>
                        <button
                          onClick={() => handleDeleteLink(link.id)}
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            background: "none",
                            border: "none",
                            color: "rgba(255,255,255,0.2)",
                            fontSize: 14,
                            cursor: "pointer",
                            lineHeight: 1,
                            padding: "2px 4px",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = "rgba(239,68,68,0.6)"}
                          onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.2)"}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {!pin.isSuggestion && sources.length > 0 && (
              <div
                style={{
                  borderTop: "1px solid rgba(255,255,255,0.07)",
                  paddingTop: 20,
                  marginTop: 8,
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: "rgba(255,255,255,0.3)",
                    fontFamily: "'JetBrains Mono', monospace",
                    marginBottom: 8,
                  }}
                >
                  Sources
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {sources.map((src, i) => {
                    const meta = sourceMeta[src];
                    const isUrl = src.startsWith("http");
                    const hostname = isUrl
                      ? (() => { try { return new URL(src).hostname.replace(/^www\./, ""); } catch { return src; } })()
                      : null;
                    return (
                      <div key={i} style={{ position: "relative" }}>
                        <a
                          href={isUrl ? src : undefined}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            display: "block",
                            padding: "10px 32px 10px 12px",
                            borderRadius: 6,
                            border: "1px solid rgba(255,255,255,0.08)",
                            background: "rgba(255,255,255,0.03)",
                            textDecoration: "none",
                            transition: "background 0.1s",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.07)"}
                          onMouseLeave={(e) => e.currentTarget.style.background = "rgba(255,255,255,0.03)"}
                        >
                          {meta?.publisher && (
                            <div style={{
                              fontSize: 10,
                              letterSpacing: "0.06em",
                              textTransform: "uppercase",
                              color: "rgba(255,255,255,0.3)",
                              fontFamily: "'JetBrains Mono', monospace",
                              marginBottom: 3,
                            }}>
                              {meta.publisher}
                            </div>
                          )}
                          <div style={{
                            fontSize: 13,
                            color: "rgba(255,255,255,0.75)",
                            lineHeight: 1.4,
                            fontWeight: meta?.title ? 500 : 400,
                            wordBreak: meta?.title ? "normal" : "break-all",
                          }}>
                            {meta?.title || src}
                          </div>
                          {meta?.title && hostname && (
                            <div style={{
                              fontSize: 11,
                              color: "rgba(255,255,255,0.25)",
                              marginTop: 3,
                              fontFamily: "'JetBrains Mono', monospace",
                            }}>
                              {hostname}
                            </div>
                          )}
                        </a>
                        <button
                          onClick={async () => {
                            await fetch(`/api/locations/${pin.id}/research/sources?url=${encodeURIComponent(src)}`, { method: "DELETE" });
                            setSources((prev) => prev.filter((_, j) => j !== i));
                          }}
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            background: "none",
                            border: "none",
                            color: "rgba(255,255,255,0.2)",
                            fontSize: 14,
                            cursor: "pointer",
                            lineHeight: 1,
                            padding: "2px 4px",
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.color = "rgba(239,68,68,0.6)"}
                          onMouseLeave={(e) => e.currentTarget.style.color = "rgba(255,255,255,0.2)"}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          {!pin.isSuggestion && research && (
            <button
              onClick={() => {
                setResearch(null);
                setStatus("none");
              }}
              style={{
                marginTop: 8,
                padding: "10px 20px",
                borderRadius: 2,
                border: "1px solid rgba(255,255,255,0.12)",
                background: "transparent",
                color: "rgba(255,255,255,0.4)",
                fontSize: 12,
                cursor: "pointer",
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: "0.04em",
              }}
            >
              Re-research
            </button>
          )}
        </div>
      </div>
    </>
  );
}
