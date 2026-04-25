import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

function relativeTime(isoString) {
  if (!isoString) return null;
  const diff = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const btnStyle = (active) => ({
  padding: "3px 7px",
  borderRadius: 4,
  border: "1px solid rgba(255,255,255,0.1)",
  background: active ? "rgba(255,255,255,0.14)" : "transparent",
  color: active ? "#fff" : "rgba(255,255,255,0.5)",
  fontSize: 12,
  cursor: "pointer",
  lineHeight: 1.4,
  fontFamily: "inherit",
});

function Toolbar({ editor }) {
  if (!editor) return null;
  return (
    <div
      style={{
        display: "flex",
        gap: 3,
        flexWrap: "wrap",
        marginBottom: 8,
      }}
    >
      <button
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
        style={btnStyle(editor.isActive("bold"))}
      >
        <strong>B</strong>
      </button>
      <button
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
        style={btnStyle(editor.isActive("italic"))}
      >
        <em>I</em>
      </button>
      <button
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }}
        style={btnStyle(editor.isActive("heading", { level: 2 }))}
      >
        H2
      </button>
      <button
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }}
        style={btnStyle(editor.isActive("heading", { level: 3 }))}
      >
        H3
      </button>
      <button
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
        style={btnStyle(editor.isActive("bulletList"))}
      >
        •–
      </button>
      <button
        onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
        style={btnStyle(editor.isActive("orderedList"))}
      >
        1.
      </button>
    </div>
  );
}

export default function NotesEditor({
  pinId,
  initialContent,
  initialEditedBy,
  initialEditedAt,
  user,
}) {
  const [editedBy, setEditedBy] = useState(initialEditedBy ?? null);
  const [editedAt, setEditedAt] = useState(initialEditedAt ?? null);
  const [saving, setSaving] = useState(false);
  const saveTimer = useRef(null);

  const editor = useEditor({
    extensions: [StarterKit, Placeholder.configure({ placeholder: "Add notes…" })],
    content: initialContent || "",
    editorProps: {
      attributes: {
        style:
          "outline: none; min-height: 80px; font-size: 13px; line-height: 1.6; color: rgba(255,255,255,0.75);",
      },
    },
    onUpdate({ editor }) {
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(async () => {
        setSaving(true);
        try {
          const res = await fetch(`/api/locations/${pinId}/notes`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ notes: editor.getHTML(), edited_by: user }),
          });
          if (res.ok) {
            const data = await res.json();
            setEditedBy(data.notes_last_edited_by);
            setEditedAt(data.notes_last_edited_at);
          }
        } finally {
          setSaving(false);
        }
      }, 1000);
    },
  });

  useEffect(() => {
    return () => clearTimeout(saveTimer.current);
  }, []);

  return (
    <div>
      <Toolbar editor={editor} />
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 6,
          border: "1px solid rgba(255,255,255,0.08)",
          background: "rgba(255,255,255,0.03)",
        }}
      >
        <style>{`
          .tiptap p { margin: 0 0 6px; }
          .tiptap p:last-child { margin-bottom: 0; }
          .tiptap h2 { font-size: 15px; font-weight: 700; margin: 10px 0 4px; color: rgba(255,255,255,0.9); }
          .tiptap h3 { font-size: 13px; font-weight: 600; margin: 8px 0 4px; color: rgba(255,255,255,0.8); }
          .tiptap ul, .tiptap ol { margin: 4px 0; padding-left: 18px; }
          .tiptap li { margin-bottom: 2px; }
          .tiptap strong { color: rgba(255,255,255,0.9); }
          .tiptap code { font-family: 'JetBrains Mono', monospace; font-size: 11px; background: rgba(255,255,255,0.08); padding: 1px 4px; border-radius: 3px; }
          .tiptap p.is-editor-empty:first-child::before { content: attr(data-placeholder); color: rgba(255,255,255,0.2); pointer-events: none; float: left; height: 0; }
        `}</style>
        <EditorContent editor={editor} />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 6,
          fontSize: 10,
          fontFamily: "'JetBrains Mono', monospace",
          color: "rgba(255,255,255,0.25)",
        }}
      >
        <span>
          {editedBy
            ? `last edited by ${editedBy}${editedAt ? ` · ${relativeTime(editedAt)}` : ""}`
            : ""}
        </span>
        <span style={{ color: saving ? "oklch(0.82 0.13 200)" : "transparent" }}>
          saving…
        </span>
      </div>
    </div>
  );
}
