import { createSignal, createMemo, For, Show } from "solid-js";
import { UpdateNote } from "../../wailsjs/go/main/App";
import "./NotesView.css";
import { marked } from "marked";

// ── Markdown setup ─────────────────────────────────────────────────────────────
// Code blocks render as plain pre/code (no syntax highlighting) to stay light.
marked.use({
  renderer: {
    code({ text = "" } = {}) {
      const esc = text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<pre class="md-code"><code>${esc}</code></pre>`;
    },
    codespan({ text = "" } = {}) {
      const esc = (typeof text === "string" ? text : String(text))
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
      return `<code class="md-inline-code">${esc}</code>`;
    }
  },
  gfm: true,
  breaks: true
});

function renderMarkdown(text) {
  try {
    return marked.parse(text || "");
  } catch {
    return `<p>${text || ""}</p>`;
  }
}

function fmtDate(iso) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric"
    });
  } catch {
    return "";
  }
}

// ── NotesView ──────────────────────────────────────────────────────────────────
function NotesView(props) {
  // view: 'list' | 'preview' | 'edit'
  const [view, setView] = createSignal("edit");
  const [activeNote, setActiveNote] = createSignal(null);
  const [editContent, setEditContent] = createSignal("");
  let textareaRef;

  const visibleNotes = createMemo(() => {
    return props.notes;
  });

  // ── navigation helpers ──────────────────────────────────────────────────────
  const openPreview = (note) => {
    setActiveNote(note);
    setView("preview");
  };

  const openEdit = (note) => {
    setActiveNote(note || null);
    setEditContent(note?.content || "");
    setView("edit");
    setTimeout(() => textareaRef?.focus(), 30);
  };

  const goBack = () => {
    if (view() === "preview") {
      setView("list");
      setActiveNote(null);
      return;
    }
    if (view() === "edit") {
      setView(activeNote() ? "preview" : "list");
      return;
    }
  };

  // ── actions ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    const content = editContent().trim();
    if (!content) return;
    if (activeNote()) {
      await UpdateNote(activeNote().id, content);
    } else {
      await props.onSave(content);
    }
    await props.onReload();
    setView("list");
    setActiveNote(null);
  };

  const handleDelete = async (id) => {
    await props.onDelete(id);
    await props.onReload();
    setView("list");
    setActiveNote(null);
  };

  const handleTextareaKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
    if (e.key === "Escape") goBack();
  };

  // ── render ──────────────────────────────────────────────────────────────────
  return (
    <div class="notes-view">
      {/* ── LIST ─────────────────────────────────────────────────────────── */}
      <Show when={view() === "list"}>
        <div class="notes-list">
          <Show when={visibleNotes().length === 0}>
            <div class="notes-empty">
              <svg
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
                stroke="currentColor"
                stroke-width="1.3"
                stroke-linecap="round"
                stroke-linejoin="round"
                style="opacity:0.22; margin-bottom:8px"
              >
                <path d="M6 4h13a2 2 0 012 2v14l-5 5H6a2 2 0 01-2-2V6a2 2 0 012-2z" />
                <line x1="9" y1="10" x2="17" y2="10" />
                <line x1="9" y1="14" x2="13" y2="14" />
              </svg>
              <div class="notes-empty-sub">Click + to create one</div>
            </div>
          </Show>
          <For each={visibleNotes()}>
            {(note) => {
              const preview =
                (note.content || "").split("\n").find((l) => l.trim()) || "";
              const clean = preview
                .replace(/^#+\s*/, "")
                .replace(/[*_`]/g, "")
                .slice(0, 72);
              const fileId = note.id.split("_").join(" ");
              return (
                <div class="note-row" onClick={() => openPreview(note)}>
                  <div class="note-row-fileid">{` ${fileId}` || "(empty)"}</div>
                  <div class="note-row-preview">{` ${clean}` || "(empty)"}</div>
                  <div class="note-row-top">
                    <span class="note-row-date">{fmtDate(note.createdAt)}</span>
                    <button
                      class="note-row-del"
                      title="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(note.id);
                      }}
                    >
                      <svg
                        width="10"
                        height="10"
                        viewBox="0 0 10 10"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="1.8"
                        stroke-linecap="round"
                      >
                        <line x1="1" y1="1" x2="9" y2="9" />
                        <line x1="9" y1="1" x2="1" y2="9" />
                      </svg>
                    </button>
                  </div>
                </div>
              );
            }}
          </For>
        </div>

        <button
          class="notes-fab"
          onClick={() => openEdit(null)}
          title="New note"
        >
          <svg
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M11.5 1.5 L13.5 3.5 L5.5 11.5 L2 13 L3.5 9.5 Z" />
            <line x1="9.5" y1="3.5" x2="11.5" y2="5.5" />
          </svg>
        </button>
      </Show>

      {/* ── PREVIEW ──────────────────────────────────────────────────────── */}
      <Show when={view() === "preview"}>
        <div class="notes-panel">
          <div class="notes-panel-bar">
            <button class="note-nav-btn" onClick={goBack}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="9,2 4,7 9,12" />
              </svg>
              Back
            </button>
            <div class="note-panel-meta">
              <span class="note-row-date">
                {fmtDate(activeNote()?.updatedAt || activeNote()?.createdAt)}
              </span>
            </div>
            <div class="note-panel-actions">
              <button
                class="note-action-btn"
                onClick={() => openEdit(activeNote())}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                >
                  <path d="M8.5 1.5l2 2L3 11H1V9z" />
                </svg>
                Edit
              </button>
              <button
                class="note-action-btn danger"
                onClick={() => handleDelete(activeNote().id)}
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.7"
                  stroke-linecap="round"
                >
                  <polyline points="1,3 11,3" />
                  <path d="M4,3V1.5h4V3" />
                  <path d="M2,3l.7,7.5h6.6L10,3" />
                </svg>
                Delete
              </button>
            </div>
          </div>
          <div class="notes-preview-body">
            <div
              class="md-body"
              innerHTML={renderMarkdown(activeNote()?.content || "")}
            />
          </div>
        </div>
      </Show>

      {/* ── EDIT ─────────────────────────────────────────────────────────── */}
      <Show when={view() === "edit"}>
        <div class="notes-panel">
          <div class="notes-panel-bar">
            <button class="note-nav-btn" onClick={goBack}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                stroke-width="1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              >
                <polyline points="9,2 4,7 9,12" />
              </svg>
              List
            </button>
            <div class="note-panel-actions" style="margin-left:auto">
              <button
                class="notes-save-btn"
                onClick={handleSave}
                disabled={!editContent().trim()}
              >
                Save ⌘↵
              </button>
            </div>
          </div>

          <textarea
            ref={textareaRef}
            class="notes-textarea"
            placeholder="Write in markdown…"
            value={editContent()}
            onInput={(e) => setEditContent(e.target.value)}
            onKeyDown={handleTextareaKey}
          />
        </div>
      </Show>
    </div>
  );
}

export default NotesView;
