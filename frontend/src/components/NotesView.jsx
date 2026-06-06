import { createSignal, For, Show } from 'solid-js';
import './NotesView.css';

const TAGS = ['Note', 'TODO', 'Snippet', 'Idea'];

const TAG_COLORS = {
  Note:    { bg: 'rgba(100,116,139,0.12)', text: '#64748b' },
  TODO:    { bg: 'rgba(251,146,60,0.12)',  text: '#ea7a1a' },
  Snippet: { bg: 'rgba(99,102,241,0.12)', text: '#6366f1' },
  Idea:    { bg: 'rgba(34,197,94,0.12)',  text: '#16a34a' },
};

function TagPill({ tag }) {
  const c = TAG_COLORS[tag] || TAG_COLORS.Note;
  return (
    <span class="note-tag" style={{ background: c.bg, color: c.text }}>
      {tag}
    </span>
  );
}

function NotesView(props) {
  const { onSave, onDelete } = props;
  const [newContent, setNewContent] = createSignal('');
  const [newTag, setNewTag] = createSignal('Note');
  const [showCompose, setShowCompose] = createSignal(false);
  let textareaRef;

  const handleSave = async () => {
    const content = newContent().trim();
    if (!content) return;
    await onSave(content, newTag());
    setNewContent('');
    setNewTag('Note');
    setShowCompose(false);
  };

  const handleKeyDown = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
    if (e.key === 'Escape') {
      setShowCompose(false);
    }
  };

  const openCompose = () => {
    setShowCompose(true);
    setTimeout(() => { if (textareaRef) textareaRef.focus(); }, 30);
  };

  return (
    <div class="notes-view">
      {/* Compose area */}
      <Show when={showCompose()}>
        <div class="notes-compose">
          <textarea
            ref={textareaRef}
            class="notes-textarea"
            placeholder="Write a note..."
            value={newContent()}
            onInput={(e) => setNewContent(e.target.value)}
            onKeyDown={handleKeyDown}
            rows="3"
          />
          <div class="notes-compose-footer">
            <div class="notes-tag-row">
              <For each={TAGS}>
                {(tag) => (
                  <button
                    class={"tag-select-btn" + (newTag() === tag ? ' active' : '')}
                    onClick={() => setNewTag(tag)}
                    style={newTag() === tag ? { background: TAG_COLORS[tag].bg, color: TAG_COLORS[tag].text } : {}}
                  >
                    {tag}
                  </button>
                )}
              </For>
            </div>
            <div class="notes-compose-actions">
              <button class="notes-cancel-btn" onClick={() => setShowCompose(false)}>Cancel</button>
              <button class="notes-save-btn" onClick={handleSave} disabled={!newContent().trim()}>Save  ⌘↵</button>
            </div>
          </div>
        </div>
      </Show>

      {/* List */}
      <div class="notes-list">
        <Show when={props.notes.length === 0}>
          <div class="notes-empty">
            <div class="notes-empty-icon">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="opacity:0.3">
                <path d="M4 4h12a2 2 0 012 2v12l-4 4H4a2 2 0 01-2-2V6a2 2 0 012-2z"/>
                <line x1="7" y1="9" x2="15" y2="9"/>
                <line x1="7" y1="13" x2="12" y2="13"/>
              </svg>
            </div>
            <div class="notes-empty-text">No notes yet</div>
            <div class="notes-empty-sub">Click + to save a snippet, idea, or to-do</div>
          </div>
        </Show>
        <For each={props.notes}>
          {(note) => (
            <div class="note-item">
              <div class="note-header">
                <TagPill tag={note.tag} />
                <span class="note-date">{new Date(note.createdAt).toLocaleDateString()}</span>
                <button class="note-delete-btn" onClick={() => onDelete(note.id)} title="Delete">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
                    <line x1="2" y1="2" x2="10" y2="10"/><line x1="10" y1="2" x2="2" y2="10"/>
                  </svg>
                </button>
              </div>
              <div class="note-content">{note.content}</div>
            </div>
          )}
        </For>
      </div>

      {/* FAB: new note */}
      <Show when={!showCompose()}>
        <button class="notes-fab" onClick={openCompose} title="New note">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
            <line x1="8" y1="2" x2="8" y2="14"/>
            <line x1="2" y1="8" x2="14" y2="8"/>
          </svg>
        </button>
      </Show>
    </div>
  );
}

export default NotesView;
