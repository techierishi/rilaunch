import { createSignal, onMount } from 'solid-js';
import './SettingsView.css';

function SettingsView(props) {
  const [notesDir, setNotesDir] = createSignal('');

  onMount(async () => {
    const dir = await GetNotesDir();
    setNotesDir(dir);
  });

  const handleBrowse = async () => {
    const newDir = await ChooseNotesDir();
    setNotesDir(newDir);
  };

  return (
    <div class="settings-overlay">
      <div class="settings-panel">
        {/* Header */}
        <div class="settings-header">
          <span class="settings-title">Settings</span>
          <button class="settings-close" onClick={props.onClose} title="Close">
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <line x1="1" y1="1" x2="10" y2="10"/>
              <line x1="10" y1="1" x2="1" y2="10"/>
            </svg>
          </button>
        </div>

        {/* Notes dir setting */}
        <div class="settings-section">
          <div class="settings-label">Notes folder</div>
          <div class="settings-row">
            <span class="settings-path">{notesDir()}</span>
            <button class="settings-browse-btn" onClick={handleBrowse}>Browse…</button>
          </div>
          <div class="settings-hint">Markdown files are saved here, one per note.</div>
        </div>
      </div>
    </div>
  );
}

export default SettingsView;
